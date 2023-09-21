import {
	assertDocument,
	Document,
	DocumentKey,
	isDocument,
} from "../../common/document/document.ts";
import {
	DocumentCreateError,
	DocumentNotFoundError,
} from "../../common/document/errors.ts";
import { createLogger } from "../../common/system/logger.ts";
import {
	DocumentAtomic,
	DocumentAtomicsResult,
	DocumentGetOptions,
	DocumentListOptions,
	DocumentListResult,
	DocumentProvider,
} from "../document.ts";

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
	async get<Data = unknown>(
		key: DocumentKey,
		_options?: DocumentGetOptions,
	): Promise<Document<Data>> {
		try {
			const keyString = keyPathToKeyString([this.#prefix, ...key]);
			const document = JSON.parse(
				this.#storage.getItem(keyString) ?? "null",
			) as unknown;
			assertDocument(document);
			return document as Document<Data>;
		} catch (error) {
			this.#logger.error(`Couldn't get document ${key}, got error : ${error}.`);
			throw new DocumentNotFoundError();
		}
	}

	// deno-lint-ignore require-await
	async getMany<Data = unknown>(
		keys: DocumentKey[],
		_options?: DocumentGetOptions,
	): Promise<Document<Data>[]> {
		const documents: Document<Data>[] = [];
		for (const key of keys) {
			const keyString = keyPathToKeyString([this.#prefix, ...key]);
			const document = JSON.parse(this.#storage.getItem(keyString) ?? "null");
			if (isDocument(document)) {
				documents.push(document as Document<Data>);
			}
		}
		return documents;
	}

	// deno-lint-ignore require-await
	async list(
		{ prefix, cursor, limit }: DocumentListOptions,
	): Promise<DocumentListResult> {
		const prefixString = keyPathToKeyString([this.#prefix, ...prefix]);
		const prefixLength = prefixString.length;
		const cursorString = keyPathToKeyString([
			this.#prefix,
			...(cursor ? keyStringToKeyPath(atob(cursor)) : []),
		]);
		const keys: DocumentKey[] = [];
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
				keys.push(keyPath);
				if (count >= limit) {
					break;
				}
			}
		}
		const done = count !== limit;
		return {
			keys,
			cursor: done ? undefined : btoa(keyPathToKeyString(keys.at(-1)!)),
		};
	}

	// deno-lint-ignore require-await
	async create<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
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

	async update<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
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

	async patch<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Partial<Data>>,
	): Promise<void> {
		const document = await this.get<Data>(key);
		const keyString = keyPathToKeyString([this.#prefix, ...key]);
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
