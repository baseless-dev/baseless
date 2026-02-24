import {
	type Document,
	DocumentAtomic,
	DocumentAtomicCommitError,
	type DocumentGetOptions,
	type DocumentListEntry,
	type DocumentListOptions,
	DocumentNotFoundError,
	DocumentProvider,
} from "@baseless/server";
import OrderedMap from "./ordered_map.ts";

/**
 * In-memory implementation of {@link DocumentProvider}.
 *
 * Stores documents in an {@link OrderedMap} keyed by their path.  Suitable
 * for unit tests and local development; data is not persisted.
 */
export class MemoryDocumentProvider extends DocumentProvider {
	#storage = new OrderedMap<string, Document>();

	/** Clears all stored documents and releases memory. */
	[Symbol.dispose](): void {
		this.#storage.clear();
	}

	// deno-lint-ignore require-await
	/**
	 * Retrieves a single document by key.
	 * @param key The document path.
	 * @param _options Ignored; present for interface compatibility.
	 * @returns A deep clone of the stored {@link Document}.
	 * @throws {@link DocumentNotFoundError} When no document exists at `key`.
	 */
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
	/**
	 * Retrieves multiple documents in a single operation.
	 * @param keys Array of document paths to retrieve.
	 * @param _options Ignored; present for interface compatibility.
	 * @returns An array of deep-cloned {@link Document} values for keys that exist.
	 */
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

	/**
	 * Lists documents whose path starts with `prefix`, skipping to `cursor` if
	 * provided, and capping results at `limit`.
	 * @param options Listing options (prefix, cursor, limit).
	 * @returns A `ReadableStream` of {@link DocumentListEntry} values in key order.
	 */
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

	/**
	 * Creates a new {@link MemoryDocumentAtomic} batch builder for this provider.
	 * @returns A fresh atomic batch.
	 */
	atomic(): DocumentAtomic {
		return new MemoryDocumentAtomic(this, this.#storage);
	}
}

/**
 * Atomic batch builder for {@link MemoryDocumentProvider}.
 *
 * Implements the {@link DocumentAtomic} contract using in-memory
 * optimistic-concurrency versionstamp checks.
 */
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

	/**
	 * Applies all accumulated checks and operations to the in-memory store.
	 *
	 * Validates every {@link DocumentAtomicCheck} versionstamp before writing;
	 * throws {@link DocumentAtomicCommitError} if any check fails.
	 *
	 * @throws {@link DocumentAtomicCommitError} When a versionstamp check fails.
	 */
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
