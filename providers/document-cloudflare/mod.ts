import {
	type Document,
	type DocumentKey,
	isDocument,
} from "../../common/document/document.ts";
import {
	DocumentAtomicError,
	DocumentCreateError,
	DocumentDeleteError,
	DocumentNotFoundError,
	DocumentPatchError,
	DocumentUpdateError,
} from "../../common/document/errors.ts";
import { autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import {
	DocumentAtomic,
	type DocumentAtomicCheck,
	type DocumentAtomicsResult,
	type DocumentGetOptions,
	type DocumentListOptions,
	type DocumentListResult,
	DocumentProvider,
} from "../document.ts";
import type {
	DurableObject,
	DurableObjectNamespace,
	DurableObjectState,
	DurableObjectStorage,
	KVNamespace,
} from "npm:@cloudflare/workers-types@4.20230914.0/experimental";

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class CloudflareDocumentProvider extends DocumentProvider {
	#logger = createLogger("document-cloudflare");
	#kv: KVNamespace;
	#do: DurableObjectNamespace;

	constructor(
		kvNS: KVNamespace,
		doNS: DurableObjectNamespace,
	) {
		super();
		this.#kv = kvNS;
		this.#do = doNS;
	}

	async get<Data = unknown>(
		key: DocumentKey,
		options?: DocumentGetOptions,
	): Promise<Document<Data>> {
		const keyString = keyPathToKeyString(key);
		if (options?.consistency === "strong") {
			const doId = this.#do.idFromName(keyString);
			const doStud = this.#do.get(doId);
			const response = await doStud.fetch("https://example.com/get", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key }),
			}).catch((
				_,
			) => undefined);
			if (response?.status !== 200) {
				throw new DocumentNotFoundError();
			}
			const value = await response.json() as unknown;
			return value as Document<Data>;
		} else {
			const value = await this.#kv.get(keyString, "json");
			if (!isDocument(value)) {
				throw new DocumentNotFoundError();
			}
			return value as Document<Data>;
		}
	}

	async getMany<Data = unknown>(
		keys: DocumentKey[],
		options?: DocumentGetOptions,
	): Promise<Document<Data>[]> {
		const documentSettleResults = await Promise.allSettled(
			keys.map((key) => this.get<Data>(key, options)),
		);
		const documentResults = documentSettleResults.filter((
			p,
		): p is PromiseFulfilledResult<Document<Data>> => p.status === "fulfilled");
		const documents = documentResults.map((p) => p.value);
		return documents;
	}

	async list(options: DocumentListOptions): Promise<DocumentListResult> {
		const results = await this.#kv.list({
			prefix: keyPathToKeyString(options.prefix),
			cursor: options.cursor,
			limit: options.limit,
		});
		return {
			cursor: results.list_complete === false ? results.cursor : undefined,
			keys: results.keys.map((k) => keyStringToKeyPath(k.name)),
		};
	}

	async create<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void> {
		const doId = this.#do.idFromName(keyPathToKeyString(key));
		const doStud = this.#do.get(doId);
		const response = await doStud.fetch("https://example.com/create", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key, data }),
		}).catch((_) => undefined);
		if (response?.status !== 200) {
			throw new DocumentCreateError();
		}
	}

	async update<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void> {
		const doId = this.#do.idFromName(keyPathToKeyString(key));
		const doStud = this.#do.get(doId);
		const response = await doStud.fetch("https://example.com/update", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key, data }),
		}).catch((_) => undefined);
		if (response?.status !== 200) {
			throw new DocumentUpdateError();
		}
	}

	async patch<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Partial<Data>>,
	): Promise<void> {
		const doId = this.#do.idFromName(keyPathToKeyString(key));
		const doStud = this.#do.get(doId);
		const response = await doStud.fetch("https://example.com/patch", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key, data }),
		}).catch((_) => undefined);
		if (response?.status !== 200) {
			throw new DocumentPatchError();
		}
	}

	async delete(key: DocumentKey): Promise<void> {
		const doId = this.#do.idFromName(keyPathToKeyString(key));
		const doStud = this.#do.get(doId);
		const response = await doStud.fetch("https://example.com/delete", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key }),
		}).catch((_) => undefined);
		if (response?.status !== 200) {
			throw new DocumentDeleteError();
		}
	}
	async deleteMany(keys: DocumentKey[]): Promise<void> {
		await Promise.all(keys.map((key) => this.delete(key)));
	}

	async commit(atomic: DocumentAtomic): Promise<DocumentAtomicsResult> {
		const lock = autoid("lock-");
		const expireAt = new Date().getTime() + 1000 * 60 * 2;
		let acquiredLocks: DurableObjectStub[] = [];
		try {
			// Acquire lock
			const acquiringLockResult = await Promise.allSettled(
				atomic.checks.map(async (check) => {
					try {
						const doId = this.#do.idFromName(keyPathToKeyString(check.key));
						const doStub = this.#do.get(doId);
						const response = await doStub.fetch(
							"https://example.com/acquireLock",
							{
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ check, lock, expireAt }),
							},
						);
						if (response?.status !== 200) {
							return doStub;
						}
					} catch (error) {
						throw error;
					}
				}),
			);
			acquiredLocks = acquiringLockResult
				.filter((r): r is PromiseFulfilledResult<DurableObjectStub> =>
					r.status === "fulfilled"
				)
				.map((r) => r.value);
			if (acquiringLockResult.length !== acquiredLocks.length) {
				throw new DocumentAtomicError();
			}
			// // Perform op with lock key
			await Promise.allSettled(atomic.ops.map(async (op) => {
				try {
					const doId = this.#do.idFromName(keyPathToKeyString(op.key));
					const doStub = this.#do.get(doId);
					await doStub.fetch(`https://example.com/${op.type}`, {
						method: "POST",
						headers: { "Content-Type": "application/json", "X-Lock-Key": lock },
						body: JSON.stringify(
							op.type === "set"
								? { key: op.key, data: op.data }
								: { key: op.key },
						),
					});
				} catch (error) {
					throw error;
				}
			}));
			return { ok: true };
		} catch (error) {
			this.#logger.error(`Document atomic error: ${error}`);
			throw new DocumentAtomicError();
		} finally {
			// Release lock
			await Promise.allSettled(
				acquiredLocks.map((doStud) =>
					doStud.fetch("https://example.com/releaseLock", {
						method: "POST",
						headers: { "X-Lock-Key": lock },
					})
				),
			);
		}
	}
}

export class CloudflareDocumentDurableObject implements DurableObject {
	#logger = createLogger("document-cloudflare-do");
	#storage: DurableObjectStorage;
	#kv: KVNamespace;
	#document: Document | undefined;
	#lock: { lock: string; expireAt: number } | undefined;

	constructor(state: DurableObjectState, env: { DOCUMENT_KV: KVNamespace }) {
		this.#kv = env.DOCUMENT_KV;
		this.#storage = state.storage;
		state.blockConcurrencyWhile(async () => {
			this.#document = await this.#storage.get("document");
			this.#lock = await this.#storage.get("lock");
		});
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const op = url.pathname.split("/")[1];
		const now = new Date().getTime();
		if (op === "get") {
			return Response.json(this.#document, { status: 200 });
		}
		if (
			this.#lock && this.#lock.expireAt > now &&
			request.headers.get("X-Lock-Key") !== this.#lock.lock
		) {
			return new Response(null, { status: 423 });
		}
		if (op === "create" || op === "set" || op === "update") {
			if (op === "create" && this.#document) {
				return new Response(null, { status: 409 });
			}
			if (op === "update" && !this.#document) {
				return new Response(null, { status: 404 });
			}
			const { key, data } = await request.json() as any;
			const versionstamp = new Date().getTime().toString();
			this.#document = {
				key,
				data,
				versionstamp,
			};
			await this.#storage.put("document", this.#document);
			await this.#kv.put(
				keyPathToKeyString(key),
				JSON.stringify(this.#document),
			);
			return new Response(null, { status: 200 });
		}
		if (op === "patch") {
			if (!this.#document) {
				return new Response(null, { status: 404 });
			}
			const { key, data } = await request.json() as any;
			const versionstamp = new Date().getTime().toString();
			this.#document = {
				key: key,
				data: { ...this.#document.data, ...data },
				versionstamp,
			};
			await this.#storage.put("document", this.#document);
			await this.#kv.put(
				keyPathToKeyString(key),
				JSON.stringify(this.#document),
			);
			return new Response(null, { status: 200 });
		}
		if (op === "delete") {
			const { key } = await request.json() as any;
			this.#document = undefined;
			await this.#storage.delete("document");
			await this.#kv.delete(keyPathToKeyString(key));
			return new Response(null, { status: 200 });
		}
		if (op === "acquireLock") {
			const data = await request.json() as Readonly<
				{ check: DocumentAtomicCheck; lock: string; expireAt: number }
			>;
			if (data.check.type === "notExists") {
				if (this.#document) {
					return new Response(null, { status: 409 });
				}
			} else {
				if (
					!this.#document ||
					this.#document.versionstamp !== data.check.versionstamp
				) {
					return new Response(null, { status: 409 });
				}
			}
			this.#lock = { lock: data.lock, expireAt: data.expireAt };
			await this.#storage.put("lock", this.#lock);
			return new Response(null, { status: 200 });
		}
		if (op === "releaseLock") {
			const lock = request.headers.get("X-Lock-Key");
			if (this.#lock?.lock !== lock) {
				return new Response(null, { status: 409 });
			}
			this.#lock = undefined;
			await this.#storage.delete("lock");
			return new Response(null, { status: 200 });
		}
		return new Response(null, { status: 501 });
	}
}