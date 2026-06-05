// deno-lint-ignore-file require-await
import {
	type KVGetOptions,
	type KVKey,
	KVKeyNotFoundError,
	type KVListOptions,
	type KVListResult,
	KVProvider,
	type KVPutOptions,
} from "@baseless/server";
import tracer from "./tracer.ts";

/**
 * In-memory implementation of {@link KVProvider}.
 *
 * Stores key-value pairs in a `Map` with optional TTL-based expiration.
 * Suitable for unit tests and local development; data is not persisted.
 */
export class MemoryKVProvider extends KVProvider {
	#storage = new Map<string, { value: unknown; expiration?: number }>();

	/** Clears all stored entries and releases memory. */
	[Symbol.dispose](): void {
		this.#storage.clear();
	}

	/**
	 * Evicts all entries whose TTL has elapsed.
	 *
	 * Call this periodically to reclaim memory in long-running processes.
	 */
	public clearExpired(): void {
		const now = Date.now();
		for (const [key, data] of this.#storage) {
			if (data.expiration && data.expiration <= now) {
				this.#storage.delete(key);
			}
		}
	}

	/**
	 * Retrieves the value stored at `key`.
	 * @param key The KV key.
	 * @param _options Ignored; present for interface compatibility.
	 * @returns The {@link KVKey} entry at the given key.
	 * @throws {@link KVKeyNotFoundError} When no entry exists at `key` or the entry has expired.
	 */
	async get(key: string, options?: KVGetOptions): Promise<KVKey> {
		return tracer.startActiveSpan("@baseless/inmemory-provider.kv.get", async (span) => {
			span.setAttribute("document.key", key);
			span.setAttribute("options.cacheTtl", options?.cacheTtl ?? "");
			try {
				const item = this.#storage.get(key);
				if (!item || (item.expiration && item.expiration < new Date().getTime())) {
					throw new KVKeyNotFoundError();
				}
				return {
					...structuredClone(item),
					key,
				};
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	/**
	 * Stores `value` at `key` with optional TTL-based expiration.
	 * @param key The KV key.
	 * @param value The value to store.
	 * @param options Optional put options (`expiration` as a `Date` or ms offset).
	 */
	async put(key: string, value: unknown, options?: KVPutOptions): Promise<void> {
		return tracer.startActiveSpan("@baseless/inmemory-provider.kv.put", async (span) => {
			span.setAttribute("kv.key", key);
			span.setAttribute(
				"options.expiration",
				options?.expiration ? options.expiration instanceof Date ? options.expiration.toISOString() : options.expiration : "",
			);
			try {
				const now = new Date().getTime();
				const expiration = options?.expiration
					? options.expiration instanceof Date ? options.expiration.getTime() : options.expiration + now
					: undefined;
				const item = { value, expiration };
				this.#storage.set(key, item);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	/**
	 * Lists entries whose key starts with `prefix`, skipping to `cursor` if
	 * provided, and capping results at `limit`.
	 * @param options Listing options (prefix, cursor, limit).
	 * @returns A {@link KVListResult} page of matching entries.
	 */
	async list(
		{ prefix, cursor = "", limit = Number.MAX_VALUE }: KVListOptions,
	): Promise<KVListResult> {
		return tracer.startActiveSpan("@baseless/inmemory-provider.kv.list", async (span) => {
			span.setAttribute("options.prefix", prefix);
			span.setAttribute("options.cursor", cursor ?? "");
			span.setAttribute("options.limit", limit ?? "");
			try {
				const prefixLength = prefix.length;
				const cursorString = cursor;
				const keys = [];
				let count = 0;
				for (const [key, value] of this.#storage.entries()) {
					if (
						key?.substring(0, prefixLength) === prefix &&
						key > cursorString
					) {
						count++;
						const { expiration } = value;
						keys.push({ key, expiration });
						if (count >= limit) {
							break;
						}
					}
				}
				const done = count !== limit;
				return {
					keys: keys as unknown as ReadonlyArray<KVKey>,
					done,
					next: done ? undefined : keys.at(-1)!.key,
				};
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	/**
	 * Removes the entry at `key`.
	 * @param key The KV key to delete.
	 */
	async delete(key: string): Promise<void> {
		return tracer.startActiveSpan("@baseless/inmemory-provider.kv.delete", async (span) => {
			span.setAttribute("kv.key", key);
			try {
				this.#storage.delete(key);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}
}
