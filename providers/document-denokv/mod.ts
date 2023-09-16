import {
	assertDocumentDataObject,
	assertDocumentKey,
	Document,
	DocumentKey,
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
	DocumentListOptions,
	DocumentListResult,
	DocumentProvider,
} from "../document.ts";

export class DenoKVDocumentProvider implements DocumentProvider {
	#logger = createLogger("document-denokv");
	#storage: Deno.Kv;

	public constructor(
		storage: Deno.Kv,
	) {
		this.#storage = storage;
	}

	async get<Data = unknown>(
		key: DocumentKey,
	): Promise<Document<Data>> {
		assertDocumentKey(key);
		const result = await this.#storage.get(key, { consistency: "strong" });
		if (result.versionstamp) {
			return {
				key,
				data: result.value as Data,
			};
		}
		throw new DocumentNotFoundError();
	}

	async getMany<Data = unknown>(
		keys: DocumentKey[],
	): Promise<Document<Data>[]> {
		if (!Array.isArray(keys) || !keys.every(isDocumentKey)) {
			throw new InvalidDocumentKeyError();
		}
		const documents: Document<Data>[] = [];
		const results = await this.#storage.getMany(keys, {
			consistency: "strong",
		});
		for (const result of results) {
			if (result.versionstamp) {
				documents.push({
					key: result.key as DocumentKey,
					data: result.value as Data,
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
		data: Data,
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
		data: Partial<Data>,
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
		const result = await this.#storage.atomic().delete(key).commit();
		if (!result.ok) {
			throw new DocumentDeleteError();
		}
	}

	async deleteMany(keys: DocumentKey[]): Promise<void> {
		const transactions = this.#storage.atomic();
		for (const key of keys) {
			transactions.delete(key);
		}
		const result = await transactions.commit();
		if (!result.ok) {
			throw new DocumentDeleteError();
		}
	}
}
