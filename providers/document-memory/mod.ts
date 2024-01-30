import {
	DocumentCreateError,
	DocumentNotFoundError,
	DocumentPatchError,
} from "../../lib/document/errors.ts";
import type { Document, DocumentKey } from "../../lib/document/types.ts";
import { createLogger } from "../../lib/logger.ts";
import {
	DocumentAtomic,
	type DocumentAtomicsResult,
	type DocumentGetOptions,
	type DocumentListOptions,
	type DocumentListResult,
	DocumentProvider,
} from "../document.ts";

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class MemoryDocumentProvider extends DocumentProvider {
	#logger = createLogger("document-memory");
	#storage = new Map<string, Document>();

	// deno-lint-ignore require-await
	async get<Data = unknown>(
		key: DocumentKey,
		_options?: DocumentGetOptions,
	): Promise<Document> {
		const keyString = keyPathToKeyString(key);
		const document = this.#storage.get(keyString);
		if (!document) {
			throw new DocumentNotFoundError();
		}
		return structuredClone(document);
	}

	// deno-lint-ignore require-await
	async getMany<Data = unknown>(
		keys: DocumentKey[],
		_options?: DocumentGetOptions,
	): Promise<Document[]> {
		const documents: Document[] = [];
		for (const key of keys) {
			const keyString = keyPathToKeyString(key);
			const document = this.#storage.get(keyString);
			if (document) {
				documents.push(structuredClone(document) as Document);
			}
		}
		return documents;
	}

	// deno-lint-ignore require-await
	async list(options: DocumentListOptions): Promise<DocumentListResult> {
		const keyStrings: string[] = [];
		const prefixString = keyPathToKeyString(options.prefix);
		const prefixLength = prefixString.length;
		for (const keyString of this.#storage.keys()) {
			if (
				keyString.substring(0, prefixLength) === prefixString
			) {
				keyStrings.push(keyString);
			}
		}
		keyStrings.sort();
		let keyLength = 0;
		const cursor = options.cursor ? atob(options.cursor) : undefined;
		let limitReached = false;
		const keys: DocumentKey[] = [];
		for (const keyString of keyStrings) {
			if (cursor && keyString <= cursor) {
				continue;
			}
			keys.push(keyStringToKeyPath(keyString));
			keyLength += 1;
			if (options.limit && keyLength >= options.limit) {
				limitReached = true;
				break;
			}
		}
		return {
			keys,
			cursor: keyStrings.length > 0 && limitReached
				? btoa(keyPathToKeyString(keys.at(-1)!))
				: undefined,
		};
	}

	// deno-lint-ignore require-await
	async create<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void> {
		const keyString = keyPathToKeyString(key);
		if (this.#storage.has(keyString)) {
			throw new DocumentCreateError();
		}
		this.#storage.set(keyString, {
			key,
			data,
			versionstamp: new Date().getTime().toString(),
		});
	}

	async update<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void> {
		const _ = await this.get(key);
		const keyString = keyPathToKeyString(key);
		this.#storage.set(keyString, {
			key,
			data: data,
			versionstamp: new Date().getTime().toString(),
		});
	}

	async patch<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Partial<Data>>,
	): Promise<void> {
		const document = await this.get<Data>(key);
		const keyString = keyPathToKeyString(key);
		if (typeof document.data !== "object" || typeof data !== "object") {
			throw new DocumentPatchError();
		}
		this.#storage.set(keyString, {
			key,
			data: { ...document.data, ...data },
			versionstamp: new Date().getTime().toString(),
		});
	}

	// deno-lint-ignore require-await
	async delete(key: DocumentKey): Promise<void> {
		const keyString = keyPathToKeyString(key);
		this.#storage.delete(keyString);
	}

	// deno-lint-ignore require-await
	async deleteMany(keys: DocumentKey[]): Promise<void> {
		for (const key of keys) {
			const keyString = keyPathToKeyString(key);
			this.#storage.delete(keyString);
		}
	}

	atomic(): DocumentAtomic {
		return new MemoryDocumentAtomic(this, this.#storage);
	}
}

export class MemoryDocumentAtomic extends DocumentAtomic {
	#provider: MemoryDocumentProvider;
	#storage: Map<string, Document>;

	constructor(
		provider: MemoryDocumentProvider,
		storage: Map<string, Document>,
	) {
		super();
		this.#provider = provider;
		this.#storage = storage;
	}

	async commit(): Promise<DocumentAtomicsResult> {
		for (const check of this.checks) {
			if (check.type === "notExists") {
				if (this.#storage.has(keyPathToKeyString(check.key))) {
					return { ok: false };
				}
			} else {
				try {
					const document = await this.#provider.get(check.key);
					if (document.versionstamp !== check.versionstamp) {
						return { ok: false };
					}
				} catch (_) {
					return { ok: false };
				}
			}
		}
		for (const op of this.ops) {
			const keyString = keyPathToKeyString(op.key);
			if (op.type === "delete") {
				this.#storage.delete(keyString);
			} else {
				this.#storage.set(keyString, {
					key: op.key,
					data: op.data,
					versionstamp: new Date().getTime().toString(),
				});
			}
		}
		return { ok: true };
	}
}
