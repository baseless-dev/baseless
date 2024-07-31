import {
	DocumentAtomic,
	DocumentAtomicsResult,
	DocumentCreateError,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentNotFoundError,
	DocumentProvider,
} from "@baseless/server/provider";
import { Document } from "@baseless/core/document";
import OrderedMap from "@baseless/core/orderedmap";

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

function keyStringToKeyPath(key: string): string[] {
	return key.split(/(?<!\\)\//).map((p) => p.replaceAll("\\/", "/"));
}

export class MemoryDocumentProvider extends DocumentProvider {
	#storage = new OrderedMap<string, Document>();

	// deno-lint-ignore require-await
	async get(
		key: string[],
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
	async getMany(
		keys: Array<string[]>,
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

	async *list(
		options: DocumentListOptions,
	): AsyncIterableIterator<DocumentListEntry> {
		const cursorString = options.cursor ? atob(options.cursor) : "";
		const prefixString = keyPathToKeyString(options.prefix);
		const prefixLength = prefixString.length;
		let count = 0;
		for (const [keyString, document] of this.#storage) {
			if (
				keyString.substring(0, prefixLength) === prefixString &&
				keyString > cursorString
			) {
				const cursor = btoa(keyString);
				yield {
					cursor,
					document,
				};
				count += 1;
				if (options.limit && count >= options.limit) {
					break;
				}
			}
		}
	}

	// deno-lint-ignore require-await
	async create(
		key: string[],
		data: unknown,
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

	async update(
		key: string[],
		data: unknown,
	): Promise<void> {
		const _ = await this.get(key);
		const keyString = keyPathToKeyString(key);
		this.#storage.set(keyString, {
			key,
			data: data,
			versionstamp: new Date().getTime().toString(),
		});
	}

	// deno-lint-ignore require-await
	async delete(key: string[]): Promise<void> {
		const keyString = keyPathToKeyString(key);
		this.#storage.delete(keyString);
	}

	// deno-lint-ignore require-await
	async deleteMany(keys: Array<string[]>): Promise<void> {
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
	#storage: OrderedMap<string, Document>;

	constructor(
		provider: MemoryDocumentProvider,
		storage: OrderedMap<string, Document>,
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
