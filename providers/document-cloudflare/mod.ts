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
import { type AutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger, type Logger } from "../../common/system/logger.ts";
import {
	DocumentAtomic,
	type DocumentAtomicCheck,
	type DocumentAtomicsResult,
	type DocumentGetOptions,
	type DocumentListOptions,
	type DocumentListResult,
	DocumentProvider,
} from "../document.ts";
/// <reference types="https://esm.sh/v132/@cloudflare/workers-types@4.20230914.0/index.d.ts" />

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class CloudFlareDocumentProvider extends DocumentProvider {
	#logger = createLogger("document-cloudflare");
	#kv: KVNamespace;
	#do: DurableObjectNamespace;

	// deno-lint-ignore no-explicit-any
	constructor(kvNS: any, doNS: any) {
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
			if (!isDocument(value)) {
				throw new DocumentNotFoundError();
			}
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
		}).catch(() => undefined);
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
		}).catch(() => undefined);
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
		}).catch(() => undefined);
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
		}).catch(() => undefined);
		if (response?.status !== 200) {
			throw new DocumentDeleteError();
		}
	}
	async deleteMany(keys: DocumentKey[]): Promise<void> {
		await Promise.all(keys.map((key) => this.delete(key)));
	}

	atomic(): DocumentAtomic {
		return new CloudFlareDocumentAtomic(this.#kv, this.#do, this.#logger);
	}
}

export class CloudFlareDocumentAtomic extends DocumentAtomic {
	#kv: KVNamespace;
	#do: DurableObjectNamespace;
	#logger: Logger;

	// deno-lint-ignore no-explicit-any
	constructor(kvNS: any, doNS: any, logger: Logger) {
		super();
		this.#kv = kvNS;
		this.#do = doNS;
		this.#logger = logger;
	}

	async commit(): Promise<DocumentAtomicsResult> {
		const lock = autoid("lock-");
		const expireAt = new Date().getTime() + 1000 * 60 * 2;
		let rollback = false;

		// Determined keys to lock
		const keysToLock: Array<
			{ key: DocumentKey; type?: string; versionstamp?: string }
		> = [
			...this.checks,
			...this.ops.map((op) => ({
				key: op.key,
			})),
		];
		const uniqueKeysToLock = Object.values(keysToLock.reduce(
			(map, item) => {
				const keyString = keyPathToKeyString(item.key);
				if (!(keyString in map) || item.type) {
					map[keyString] = item;
				}
				return map;
			},
			{} as Record<string, { key: DocumentKey; check?: DocumentAtomicCheck }>,
		));

		// Acquire locks
		const lockedStubs: DurableObjectStub[] = await Promise.allSettled(
			uniqueKeysToLock.map(async (item) => {
				const doId = this.#do.idFromName(keyPathToKeyString(item.key));
				const doStub = this.#do.get(doId);
				const response = await doStub.fetch("https://example.com/lock", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						key: item.key,
						lock,
						expireAt,
						check: item.check,
					}),
				}).catch(() => undefined);
				if (response?.status !== 200) {
					throw new DocumentAtomicError();
				}
				return doStub as unknown;
			}),
		).then((results) => {
			const t = results
				.map((r) => r.status === "fulfilled" ? r.value : undefined)
				.filter((r): r is DurableObjectStub => r !== undefined);
			return t;
		}).catch(() => []);

		try {
			// Did not acquire all locks
			if (uniqueKeysToLock.length !== lockedStubs.length) {
				throw new DocumentAtomicError();
			}

			// Perform op with lock key
			await Promise.allSettled(this.ops.map(async (op) => {
				const doId = this.#do.idFromName(keyPathToKeyString(op.key));
				const doStub = this.#do.get(doId);
				const response = await doStub.fetch(
					`https://example.com/${op.type}`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Lock-Key": lock,
						},
						body: JSON.stringify(
							op.type === "set"
								? { key: op.key, data: op.data }
								: { key: op.key },
						),
					},
				).catch(() => undefined);
				if (response?.status !== 200) {
					rollback = true;
				}
			}));
			return { ok: !rollback };
		} catch (error) {
			rollback = true;
			this.#logger.error(`Document atomic error: ${error}`);
			return { ok: false };
		} finally {
			// Release lock and rollback if nessessary
			await Promise.all(
				lockedStubs.map((doStud) =>
					doStud.fetch(
						`https://example.com/${rollback ? "rollback" : "commit"}`,
						{
							method: "POST",
							headers: { "X-Lock-Key": lock },
						},
					)
				),
			);
		}
	}
}

interface AtomicState {
	key: DocumentKey;
	lock: AutoId;
	expireAt: number;
	uncommitedDelete: boolean;
	uncommitedDocument: Document | undefined;
}

export class CloudFlareDocumentDurableObject /*implements DurableObject*/ {
	#logger = createLogger("document-cloudflare-do");
	#storage: DurableObjectStorage;
	#kv: KVNamespace;
	#document: Document | undefined;
	#atomicState?: AtomicState;

	// deno-lint-ignore no-explicit-any
	constructor(state: any, env: any) {
		this.#kv = env.DOCUMENT_KV;
		this.#storage = state.storage;
		state.blockConcurrencyWhile(async () => {
			this.#document = await this.#storage.get("document");
			this.#atomicState = await this.#storage.get("atomicState");
		});
	}

	async #setDocument(key: DocumentKey, document?: Document): Promise<void> {
		this.#document = document;
		if (document) {
			await this.#storage.put("document", document);
			await this.#kv.put(
				keyPathToKeyString(document.key),
				JSON.stringify(document),
			);
		} else {
			await this.#storage.delete("document");
			await this.#kv.delete(keyPathToKeyString(key));
		}
	}

	async #setAtomicState(atomicState?: AtomicState): Promise<void> {
		this.#atomicState = atomicState;
		if (atomicState) {
			await this.#storage.put("atomicState", atomicState);
		} else {
			await this.#storage.delete("atomicState");
		}
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const now = new Date().getTime();
		const op = url.pathname.split("/")[1];

		if (op === "get") {
			return Response.json(this.#document, { status: 200 });
		}

		if (this.#atomicState) {
			if (this.#atomicState.expireAt <= now) {
				await this.#setAtomicState(undefined);
			} else if (request.headers.get("X-Lock-Key") !== this.#atomicState.lock) {
				return new Response("Locked", { status: 423 });
			}
		}

		if (op === "create" || op === "set" || op === "update" || op === "patch") {
			if (op === "create" && this.#document) {
				return new Response("Conflict", { status: 409 });
			}
			if ((op === "update" || op === "patch") && !this.#document) {
				return new Response("Not Found", { status: 404 });
			}
			const { key, data } = await request.json() as {
				key: DocumentKey;
				data: unknown;
			};
			const versionstamp = new Date().getTime().toString();
			const uncommitedDocument: Document = {
				key,
				data: op === "patch" && typeof this.#document?.data === "object" &&
						typeof data === "object"
					? { ...this.#document.data, ...data }
					: data,
				versionstamp,
			};
			if (this.#atomicState) {
				await this.#setAtomicState({
					...this.#atomicState,
					uncommitedDocument,
				});
			} else {
				await this.#setDocument(key, uncommitedDocument);
			}
			return new Response(null, { status: 200 });
		}

		if (op === "delete") {
			const { key } = await request.json() as { key: DocumentKey };
			if (this.#atomicState) {
				await this.#setAtomicState({
					...this.#atomicState,
					uncommitedDelete: true,
				});
			} else {
				await this.#setDocument(key, undefined);
			}
			return new Response(null, { status: 200 });
		} else if (op === "lock") {
			const { key, lock, expireAt, check } = await request.json() as {
				key: DocumentKey;
				lock: AutoId;
				expireAt: number;
				check?: DocumentAtomicCheck;
			};
			if (check?.type === "notExists" && this.#document) {
				return new Response("Conflict", { status: 409 });
			} else if (
				check?.type === "match" &&
				this.#document?.versionstamp !== check.versionstamp
			) {
				return new Response("Conflict", { status: 409 });
			}
			await this.#setAtomicState({
				key,
				lock,
				expireAt,
				uncommitedDelete: false,
				uncommitedDocument: undefined,
			});
			return Response.json({ ok: true }, { status: 200 });
		} else if (op === "rollback") {
			await this.#setAtomicState(undefined);
			return Response.json({ ok: true }, { status: 200 });
		} else if (op === "commit") {
			if (!this.#atomicState) {
				return new Response("Precondition Failed", { status: 412 });
			}
			if (this.#atomicState.uncommitedDelete) {
				await this.#setDocument(this.#atomicState.key, undefined);
			} else {
				await this.#setDocument(
					this.#atomicState.key,
					this.#atomicState.uncommitedDocument,
				);
			}
			await this.#setAtomicState(undefined);
			return Response.json({ ok: true }, { status: 200 });
		}

		return new Response("Bad Request", { status: 400 });
	}
}
