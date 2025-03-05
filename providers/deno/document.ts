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

export class DenoKVDocumentProvider extends DocumentProvider {
	#storage: Deno.Kv;
	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

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

	atomic(): DocumentAtomic {
		return new DenoKVDocumentAtomic(this.#storage);
	}
}

export class DenoKVDocumentAtomic extends DocumentAtomic {
	#storage: Deno.Kv;
	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

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
