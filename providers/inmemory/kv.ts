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
	async get(key: string, _options?: KVGetOptions): Promise<KVKey> {
		const item = this.#storage.get(key);
		if (!item || (item.expiration && item.expiration < new Date().getTime())) {
			throw new KVKeyNotFoundError();
		}
		return {
			...structuredClone(item),
			key,
		};
	}

	/**
	 * Stores `value` at `key` with optional TTL-based expiration.
	 * @param key The KV key.
	 * @param value The value to store.
	 * @param options Optional put options (`expiration` as a `Date` or ms offset).
	 */
	async put(key: string, value: unknown, options?: KVPutOptions): Promise<void> {
		const now = new Date().getTime();
		const expiration = options?.expiration
			? options.expiration instanceof Date ? options.expiration.getTime() : options.expiration + now
			: undefined;
		const item = { value, expiration };
		this.#storage.set(key, item);
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
	}

	/**
	 * Removes the entry at `key`.
	 * @param key The KV key to delete.
	 */
	async delete(key: string): Promise<void> {
		this.#storage.delete(key);
	}
}
