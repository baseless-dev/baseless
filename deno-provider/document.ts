import { Document } from "../core/document.ts";
import {
	DocumentAtomic,
	DocumentAtomicsResult,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentNotFoundError,
	DocumentProvider,
} from "@baseless/server/provider";

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

	async delete(key: string[]): Promise<void> {
		await this.#storage.delete(key);
	}

	async deleteMany(keys: Array<string[]>): Promise<void> {
		await Promise.allSettled(keys.map((key) => this.#storage.delete(key)));
	}

	atomic(): DocumentAtomic {
		return new DenoKVDocumentAtomic(this.#storage.atomic());
	}
}

export class DenoKVDocumentAtomic extends DocumentAtomic {
	#atomic: Deno.AtomicOperation;
	constructor(atomic: Deno.AtomicOperation) {
		super();
		this.#atomic = atomic;
	}

	check(key: string[], versionstamp: string | null = null): DocumentAtomic {
		this.#atomic.check({ key, versionstamp });
		return this;
	}

	set(key: string[], data: unknown): DocumentAtomic {
		this.#atomic.set(key, data);
		return this;
	}

	delete(key: string[]): DocumentAtomic {
		this.#atomic.delete(key);
		return this;
	}

	commit(): Promise<DocumentAtomicsResult> {
		return this.#atomic.commit();
	}
}
