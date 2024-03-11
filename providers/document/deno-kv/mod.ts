import {
	DocumentCreateError,
	DocumentDeleteError,
	DocumentNotFoundError,
	DocumentPatchError,
	DocumentUpdateError,
} from "../../../lib/document/errors.ts";
import type {
	Document,
	DocumentData,
	DocumentKey,
} from "../../../lib/document/types.ts";
import { createLogger } from "../../../lib/logger.ts";
import {
	DocumentAtomic,
	type DocumentAtomicsResult,
	type DocumentGetOptions,
	DocumentListEntry,
	type DocumentListOptions,
	DocumentProvider,
} from "../provider.ts";

export class DenoKVDocumentProvider extends DocumentProvider {
	#logger = createLogger("document-denokv");
	#storage: Deno.Kv;

	public constructor(
		storage: Deno.Kv,
	) {
		super();
		this.#storage = storage;
	}

	async get(
		key: DocumentKey,
		options?: DocumentGetOptions,
	): Promise<Document> {
		const result = await this.#storage.get(key, {
			consistency: options?.consistency ?? "eventual",
		});
		if (result.versionstamp) {
			return {
				key,
				data: result.value,
				versionstamp: result.versionstamp,
			};
		}
		throw new DocumentNotFoundError();
	}

	async getMany(
		keys: DocumentKey[],
		options?: DocumentGetOptions,
	): Promise<Document[]> {
		const documents: Document[] = [];
		const results = await this.#storage.getMany(keys, {
			consistency: options?.consistency ?? "eventual",
		});
		for (const result of results) {
			if (result.versionstamp) {
				documents.push({
					key: result.key as DocumentKey,
					data: result.value,
					versionstamp: result.versionstamp,
				});
			}
		}
		return documents;
	}

	async *list(
		options: DocumentListOptions,
	): AsyncIterableIterator<DocumentListEntry> {
		const iter = this.#storage.list({ prefix: options.prefix }, {
			consistency: "eventual",
			limit: options.limit,
			cursor: options.cursor,
		});
		for await (const entry of iter) {
			yield {
				document: {
					key: entry.key as DocumentKey,
					data: entry.value,
					versionstamp: entry.versionstamp,
				},
				cursor: iter.cursor,
			};
		}
	}

	async create(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		const result = await this.#storage.atomic()
			.check({ key, versionstamp: null })
			.set(key, data)
			.commit();
		if (!result.ok) {
			throw new DocumentCreateError();
		}
	}

	async update(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		const value = await this.#storage.get(key, { consistency: "strong" });
		const result = await this.#storage.atomic()
			.check(value)
			.set(key, data)
			.commit();
		if (!result.ok) {
			throw new DocumentUpdateError();
		}
	}

	async patch(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		const value = await this.#storage.get(key, { consistency: "strong" });
		if (typeof value.value !== "object" || typeof data !== "object") {
			throw new DocumentPatchError();
		}
		const result = await this.#storage.atomic()
			.check(value)
			.set(key, { ...value.value, ...data })
			.commit();
		if (!result.ok) {
			throw new DocumentUpdateError();
		}
	}

	async delete(key: DocumentKey): Promise<void> {
		await this.#storage.delete(key);
	}

	async deleteMany(keys: DocumentKey[]): Promise<void> {
		let transaction = this.#storage.atomic();
		for (const key of keys) {
			transaction = transaction.delete(key);
		}
		const result = await transaction.commit();
		if (!result.ok) {
			throw new DocumentDeleteError();
		}
	}

	atomic(): DocumentAtomic {
		return new DenoKVDocumentAtomic(this, this.#storage);
	}
}

export class DenoKVDocumentAtomic extends DocumentAtomic {
	#provider: DenoKVDocumentProvider;
	#storage: Deno.Kv;

	constructor(
		provider: DenoKVDocumentProvider,
		storage: Deno.Kv,
	) {
		super();
		this.#provider = provider;
		this.#storage = storage;
	}

	async commit(): Promise<DocumentAtomicsResult> {
		let transaction = this.#storage.atomic();
		for (const check of this.checks) {
			if (check.type === "notExists") {
				transaction = transaction.check({ key: check.key, versionstamp: null });
			} else {
				transaction = transaction.check({
					key: check.key,
					versionstamp: check.versionstamp,
				});
			}
		}
		for (const op of this.ops) {
			if (op.type === "set") {
				transaction = transaction.set(op.key, op.data);
			} else {
				transaction = transaction.delete(op.key);
			}
		}
		const result = await transaction.commit();
		return {
			ok: result.ok,
		};
	}
}
