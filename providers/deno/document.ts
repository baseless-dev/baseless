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
import { fromKvKey, toKvKey } from "./utils.ts";

/**
 * Deno KV-backed implementation of {@link DocumentProvider}.
 *
 * Stores documents in a {@link Deno.Kv} database, keyed by their
 * slash-separated path converted to a `Deno.KvKey` tuple.
 */
export class DenoKVDocumentProvider extends DocumentProvider {
	#storage: Deno.Kv;
	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

	/**
	 * Retrieves a single document by key.
	 * @param key The document path.
	 * @param options Optional read options forwarded to `Deno.Kv.get`.
	 * @returns The {@link Document} stored at `key`.
	 * @throws {@link DocumentNotFoundError} When no entry exists at `key`.
	 */
	async get(key: string, options?: DocumentGetOptions): Promise<Document> {
		const entry = await this.#storage.get(toKvKey(key), options);
		if (!entry.versionstamp) {
			throw new DocumentNotFoundError();
		}
		return {
			key: fromKvKey(entry.key),
			versionstamp: entry.versionstamp,
			data: entry.value,
		} satisfies Document;
	}

	/**
	 * Retrieves multiple documents in a single `Deno.Kv.getMany` call.
	 * @param keys Array of document paths to retrieve.
	 * @param options Optional read options forwarded to `Deno.Kv.getMany`.
	 * @returns An array of {@link Document} values in the same order as `keys`.
	 * @throws {@link DocumentNotFoundError} When any entry in the result has no versionstamp.
	 */
	async getMany(keys: Array<string>, options?: DocumentGetOptions): Promise<Array<Document>> {
		const entries = await this.#storage.getMany(keys.map((k) => toKvKey(k)), options);
		return entries.map((entry) => {
			if (!entry.versionstamp) {
				throw new DocumentNotFoundError();
			}
			return {
				key: fromKvKey(entry.key),
				versionstamp: entry.versionstamp,
				data: entry.value,
			} satisfies Document;
		});
	}

	/**
	 * Lists documents whose path starts with `options.prefix` as a stream.
	 * @param options Listing options (prefix, cursor, limit).
	 * @returns A `ReadableStream` of {@link DocumentListEntry} values.
	 */
	list(options: DocumentListOptions): ReadableStream<DocumentListEntry> {
		return new ReadableStream<DocumentListEntry>({
			start: async (controller) => {
				const entries = await this.#storage.list(
					{ prefix: toKvKey(options.prefix) },
					{ limit: options.limit, cursor: options.cursor },
				);
				for await (const entry of entries) {
					const document: Document = {
						key: fromKvKey(entry.key),
						versionstamp: entry.versionstamp,
						data: entry.value,
					};
					const cursor = entries.cursor;
					controller.enqueue(
						{
							cursor,
							document,
						} satisfies DocumentListEntry,
					);
				}
				controller.close();
			},
		});
	}

	/**
	 * Creates a new {@link DenoKVDocumentAtomic} batch builder for this provider.
	 * @returns A fresh atomic batch.
	 */
	atomic(): DocumentAtomic {
		return new DenoKVDocumentAtomic(this.#storage);
	}
}

/**
 * Atomic batch builder for {@link DenoKVDocumentProvider}.
 *
 * Wraps a `Deno.AtomicOperation` to implement the {@link DocumentAtomic}
 * contract, including optimistic-concurrency versionstamp checks.
 */
export class DenoKVDocumentAtomic extends DocumentAtomic {
	#storage: Deno.Kv;
	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

	/**
	 * Applies all accumulated checks and operations to the Deno KV store.
	 *
	 * Validates every versionstamp check before writing; throws
	 * {@link DocumentAtomicCommitError} if the commit is rejected.
	 *
	 * @throws {@link DocumentAtomicCommitError} When a versionstamp check fails or the atomic commit is rejected.
	 */
	async commit(): Promise<void> {
		const atomic = this.#storage.atomic();
		for (const check of this.checks) {
			atomic.check({ key: toKvKey(check.key), versionstamp: check.versionstamp });
		}
		for (const op of this.operations) {
			if (op.type === "delete") {
				atomic.delete(toKvKey(op.key));
			} else {
				atomic.set(toKvKey(op.key), op.data);
			}
		}
		const result = await atomic.commit();
		if (!result.ok) {
			throw new DocumentAtomicCommitError();
		}
	}
}
