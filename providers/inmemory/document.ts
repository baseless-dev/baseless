import {
	type Document,
	DocumentAtomic,
	DocumentAtomicCommitError,
	type DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentNotFoundError,
	DocumentProvider,
} from "@baseless/server";
import OrderedMap from "./ordered_map.ts";

export class MemoryDocumentProvider extends DocumentProvider {
	#storage = new OrderedMap<string, Document>();

	[Symbol.dispose](): void {
		this.#storage.clear();
	}

	// deno-lint-ignore require-await
	async get(
		key: string,
		_options?: DocumentGetOptions,
	): Promise<Document> {
		const document = this.#storage.get(key);
		if (!document) {
			throw new DocumentNotFoundError();
		}
		return structuredClone(document);
	}

	// deno-lint-ignore require-await
	async getMany(
		keys: Array<string>,
		_options?: DocumentGetOptions,
	): Promise<Document[]> {
		const documents: Document[] = [];
		for (const key of keys) {
			const document = this.#storage.get(key);
			if (document) {
				documents.push(structuredClone(document) as Document);
			}
		}
		return documents;
	}

	list({ cursor = "", prefix, limit = Number.MAX_VALUE }: DocumentListOptions): ReadableStream<DocumentListEntry> {
		return new ReadableStream<DocumentListEntry>({
			start: (controller) => {
				const cursorString = cursor ? atob(cursor) : "";
				const prefixLength = prefix.length;
				let count = 0;
				for (const [keyString, document] of this.#storage) {
					if (
						keyString.substring(0, prefixLength) === prefix &&
						keyString > cursorString
					) {
						const cursor = btoa(keyString);
						controller.enqueue({
							cursor,
							document,
						});
						count += 1;
						if (limit && count >= limit) {
							break;
						}
					}
				}
				controller.close();
			},
		});
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
				if (this.#storage.has(check.key)) {
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
			if (op.type === "delete") {
				this.#storage.delete(op.key);
			} else {
				this.#storage.set(op.key, {
					key: op.key,
					data: op.data,
					versionstamp: new Date().getTime().toString(),
				});
			}
		}
	}
}
