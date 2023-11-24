import {
	assertDocumentDataObject,
	assertDocumentKey,
	type Document,
	type DocumentKey,
	isDocumentKey,
} from "../../common/document/document.ts";
import {
	DocumentCreateError,
	DocumentDeleteError,
	DocumentNotFoundError,
	DocumentUpdateError,
	InvalidDocumentKeyError,
} from "../../common/document/errors.ts";
import { createLogger } from "../../common/system/logger.ts";
import {
	DocumentAtomic,
	type DocumentAtomicsResult,
	type DocumentGetOptions,
	type DocumentListOptions,
	type DocumentListResult,
	DocumentProvider,
} from "../document.ts";

export class DenoKVDocumentProvider extends DocumentProvider {
	#logger = createLogger("document-denokv");
	#storage: Deno.Kv;

	public constructor(
		storage: Deno.Kv,
	) {
		super();
		this.#storage = storage;
	}

	async get<Data = unknown>(
		key: DocumentKey,
		options?: DocumentGetOptions,
	): Promise<Document<Data>> {
		assertDocumentKey(key);
		const result = await this.#storage.get(key, {
			consistency: options?.consistency ?? "eventual",
		});
		if (result.versionstamp) {
			return {
				key,
				data: result.value as Data,
				versionstamp: result.versionstamp,
			};
		}
		throw new DocumentNotFoundError();
	}

	async getMany<Data = unknown>(
		keys: DocumentKey[],
		options?: DocumentGetOptions,
	): Promise<Document<Data>[]> {
		if (!Array.isArray(keys) || !keys.every(isDocumentKey)) {
			throw new InvalidDocumentKeyError();
		}
		const documents: Document<Data>[] = [];
		const results = await this.#storage.getMany(keys, {
			consistency: options?.consistency ?? "eventual",
		});
		for (const result of results) {
			if (result.versionstamp) {
				documents.push({
					key: result.key as DocumentKey,
					data: result.value as Data,
					versionstamp: result.versionstamp,
				});
			}
		}
		return documents;
	}

	async list(options: DocumentListOptions): Promise<DocumentListResult> {
		options.prefix && assertDocumentKey(options.prefix);
		const keys: DocumentKey[] = [];
		const results = await this.#storage.list({ prefix: options.prefix }, {
			consistency: "eventual",
			limit: options.limit,
			cursor: options.cursor,
		});
		for await (const result of results) {
			if (result.versionstamp) {
				keys.push(result.key as DocumentKey);
			}
		}
		return {
			keys,
			cursor: results.cursor ? results.cursor : undefined,
		};
	}

	async create<Data = unknown>(
		key: DocumentKey,
		data: Data,
	): Promise<void> {
		assertDocumentKey(key);
		assertDocumentDataObject(data);
		const result = await this.#storage.atomic()
			.check({ key, versionstamp: null })
			.set(key, data)
			.commit();
		if (!result.ok) {
			throw new DocumentCreateError();
		}
	}

	async update<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void> {
		assertDocumentKey(key);
		assertDocumentDataObject(data);
		const value = await this.#storage.get(key, { consistency: "strong" });
		const result = await this.#storage.atomic()
			.check(value)
			.set(key, data)
			.commit();
		if (!result.ok) {
			throw new DocumentUpdateError();
		}
	}

	async patch<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Partial<Data>>,
	): Promise<void> {
		assertDocumentKey(key);
		assertDocumentDataObject(data);
		const value = await this.#storage.get(key, { consistency: "strong" });
		const result = await this.#storage.atomic()
			.check(value)
			.set(key, { ...value.value as Data, ...data })
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
