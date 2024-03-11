import {
	DocumentCreateError,
	DocumentNotFoundError,
	DocumentPatchError,
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

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class WebStorageDocumentProvider extends DocumentProvider {
	#logger = createLogger("document-webstorage");
	#storage: Storage;
	#prefix: string;

	public constructor(
		storage: Storage,
		prefix = "kv",
	) {
		super();
		this.#storage = storage;
		this.#prefix = prefix;
	}

	// deno-lint-ignore require-await
	async get(
		key: DocumentKey,
		_options?: DocumentGetOptions,
	): Promise<Document> {
		try {
			const keyString = keyPathToKeyString([this.#prefix, ...key]);
			const document = JSON.parse(
				this.#storage.getItem(keyString) ?? "null",
			) as unknown;
			if (!document) {
				throw new DocumentNotFoundError();
			}
			return document as Document;
		} catch (error) {
			this.#logger.error(`Couldn't get document ${key}, got error : ${error}.`);
			throw new DocumentNotFoundError();
		}
	}

	// deno-lint-ignore require-await
	async getMany(
		keys: DocumentKey[],
		_options?: DocumentGetOptions,
	): Promise<Document[]> {
		const documents: Document[] = [];
		for (const key of keys) {
			const keyString = keyPathToKeyString([this.#prefix, ...key]);
			const document = JSON.parse(this.#storage.getItem(keyString) ?? "null");
			if (!document) {
				throw new DocumentNotFoundError();
			}
			documents.push(document as Document);
		}
		return documents;
	}

	async *list(
		{ limit, cursor, prefix }: DocumentListOptions,
	): AsyncIterableIterator<DocumentListEntry> {
		const prefixString = keyPathToKeyString([this.#prefix, ...prefix]);
		const prefixLength = prefixString.length;
		const cursorString = keyPathToKeyString([
			this.#prefix,
			...(cursor ? keyStringToKeyPath(atob(cursor)) : []),
		]);
		let count = 0;
		limit ??= Number.MAX_VALUE;
		for (let i = 0, l = this.#storage.length; i < l && count < limit; ++i) {
			const key = this.#storage.key(i);
			if (
				key?.substring(0, prefixLength) === prefixString &&
				key > cursorString
			) {
				count++;
				const keyPath = keyStringToKeyPath(
					key.substring(this.#prefix.length + 1),
				);
				yield {
					document: await this.get(keyPath),
					cursor: btoa(key.substring(this.#prefix.length + 1)),
				};
				if (count >= limit) {
					break;
				}
			}
		}
	}

	// deno-lint-ignore require-await
	async create(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		const keyString = keyPathToKeyString([this.#prefix, ...key]);
		if (this.#storage.getItem(keyString)) {
			throw new DocumentCreateError();
		}
		this.#storage.setItem(
			keyString,
			JSON.stringify({
				key,
				data,
				versionstamp: new Date().getTime().toString(),
			}),
		);
	}

	async update(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		const _ = await this.get(key);
		const keyString = keyPathToKeyString([this.#prefix, ...key]);
		this.#storage.setItem(
			keyString,
			JSON.stringify({
				key,
				data,
				versionstamp: new Date().getTime().toString(),
			}),
		);
	}

	async patch(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		const document = await this.get(key);
		const keyString = keyPathToKeyString([this.#prefix, ...key]);
		if (typeof document.data !== "object" || typeof data !== "object") {
			throw new DocumentPatchError();
		}
		this.#storage.setItem(
			keyString,
			JSON.stringify({
				key,
				data: { ...document.data, ...data },
				versionstamp: new Date().getTime().toString(),
			}),
		);
	}

	// deno-lint-ignore require-await
	async delete(key: DocumentKey): Promise<void> {
		const keyString = keyPathToKeyString([this.#prefix, ...key]);
		this.#storage.removeItem(keyString);
	}

	// deno-lint-ignore require-await
	async deleteMany(keys: DocumentKey[]): Promise<void> {
		for (const key of keys) {
			const keyString = keyPathToKeyString([this.#prefix, ...key]);
			this.#storage.removeItem(keyString);
		}
	}

	atomic(): DocumentAtomic {
		return new WebStorageDocumentAtomic(this, this.#storage, this.#prefix);
	}
}

export class WebStorageDocumentAtomic extends DocumentAtomic {
	#provider: WebStorageDocumentProvider;
	#storage: Storage;
	#prefix: string;

	constructor(
		provider: WebStorageDocumentProvider,
		storage: Storage,
		prefix: string,
	) {
		super();
		this.#provider = provider;
		this.#storage = storage;
		this.#prefix = prefix;
	}

	async commit(): Promise<DocumentAtomicsResult> {
		for (const check of this.checks) {
			if (check.type === "notExists") {
				if (
					this.#storage.getItem(
						keyPathToKeyString([this.#prefix, ...check.key]),
					)
				) {
					return { ok: false };
				}
			} else {
				const document = await this.#provider.get(check.key);
				if (document.versionstamp !== check.versionstamp) {
					return { ok: false };
				}
			}
		}
		for (const op of this.ops) {
			const keyString = keyPathToKeyString([this.#prefix, ...op.key]);
			if (op.type === "delete") {
				this.#storage.removeItem(keyString);
			} else {
				this.#storage.setItem(
					keyString,
					JSON.stringify({
						key: op.key,
						data: op.data,
						versionstamp: new Date().getTime().toString(),
					}),
				);
			}
		}
		return { ok: true };
	}
}
