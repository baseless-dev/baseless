/**
 * Least-recently-used cache with a fixed maximum capacity.
 *
 * When the cache is at capacity and a new key is inserted, the
 * least-recently-used entry is evicted to make room.
 *
 * @template K - The key type.
 * @template V - The value type.
 */
export class LruCache<K, V> {
	#maxSize: number;
	#storage: Map<K, V>;

	constructor(maxSize: number, entries?: readonly (readonly [K, V])[]) {
		this.#maxSize = maxSize;
		this.#storage = new Map<K, V>(entries);
	}

	/**
	 * Retrieves the value associated with `key` and marks it as most-recently used.
	 *
	 * @param key - The cache key to look up.
	 * @returns The cached value, or `undefined` if not present.
	 */
	get(key: K): V | undefined {
		if (!this.#storage.has(key)) {
			return undefined;
		}
		const value = this.#storage.get(key)!;
		this.#storage.delete(key);
		this.#storage.set(key, value);
		return value;
	}

	/**
	 * Inserts or updates the value associated with `key`.
	 *
	 * If the cache is full and `key` is not already present, the
	 * least-recently-used entry is evicted first.
	 *
	 * @param key - The cache key.
	 * @param value - The value to store.
	 * @returns `this` for chaining.
	 */
	put(key: K, value: V): this {
		if (this.#storage.size >= this.#maxSize && this.#storage.has(key) === false) {
			const oldestKey = this.#storage.keys().next().value!;
			this.#storage.delete(oldestKey);
		}
		this.#storage.delete(key);
		this.#storage.set(key, value);
		return this;
	}
}
