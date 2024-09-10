import {
	DocumentAtomic,
	DocumentAtomicCommitError,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentNotFoundError,
	DocumentProvider,
} from "@baseless/server/document-provider";
import { Document } from "@baseless/core/document";
import OrderedMap from "@baseless/core/ordered-map";

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
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
			throw new DocumentNotFoundError(key);
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

	async commit(): Promise<void> {
		for (const check of this.checks) {
			if (check.versionstamp === null) {
				if (this.#storage.has(keyPathToKeyString(check.key))) {
					throw new DocumentAtomicCommitError();
				}
			} else {
				try {
					const document = await this.#provider.get(check.key);
					if (document.versionstamp !== check.versionstamp) {
						throw new DocumentAtomicCommitError();
					}
				} catch (_) {
					throw new DocumentAtomicCommitError();
				}
			}
		}
		for (const op of this.operations) {
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
	}
}
