import type { Document } from "@baseless/core/document";
import {
	DocumentAtomic,
	DocumentAtomicCommitError,
	type DocumentGetOptions,
	type DocumentListEntry,
	type DocumentListOptions,
	DocumentNotFoundError,
	DocumentProvider,
} from "@baseless/server/document-provider";

export class DenoKVDocumentProvider extends DocumentProvider {
	#storage: Deno.Kv;
	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

	async get(key: string[], options?: DocumentGetOptions): Promise<Document> {
		const entry = await this.#storage.get(key, options);
		if (!entry.versionstamp) {
			throw new DocumentNotFoundError(entry.key as string[]);
		}
		return {
			key: entry.key as string[],
			versionstamp: entry.versionstamp,
			data: entry.value,
		} satisfies Document;
	}

	async getMany(keys: Array<string[]>, options?: DocumentGetOptions): Promise<Array<Document>> {
		const entries = await this.#storage.getMany(keys, options);
		return entries.map((entry) => {
			if (!entry.versionstamp) {
				throw new DocumentNotFoundError(entry.key as string[]);
			}
			return {
				key: entry.key as string[],
				versionstamp: entry.versionstamp,
				data: entry.value,
			} satisfies Document;
		});
	}

	async *list(options: DocumentListOptions): AsyncIterableIterator<DocumentListEntry> {
		const entries = await this.#storage.list(
			{ prefix: options.prefix },
			{ limit: options.limit, cursor: options.cursor },
		);
		for await (const entry of entries) {
			const document: Document = {
				key: entry.key as string[],
				versionstamp: entry.versionstamp,
				data: entry.value,
			};
			const cursor = entries.cursor;
			yield {
				cursor,
				document,
			} satisfies DocumentListEntry;
		}
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
			atomic.check(check);
		}
		for (const op of this.operations) {
			if (op.type === "delete") {
				atomic.delete(op.key);
			} else {
				atomic.set(op.key, op.data);
			}
		}
		const result = await atomic.commit();
		if (!result.ok) {
			throw new DocumentAtomicCommitError();
		}
	}
}
