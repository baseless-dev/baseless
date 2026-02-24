/**
 * Comparison function used to order keys in an {@link OrderedMap}.
 *
 * @template K - The key type.
 * @returns A negative number if `a < b`, zero if `a === b`, or a positive
 *   number if `a > b`.
 */
export type CompareFn<K> = (a: K, b: K) => number;

/**
 * An ordered `Map`-like collection that keeps its keys in sorted order.
 *
 * Iteration is always in ascending key order as determined by the
 * {@link CompareFn} supplied at construction time.  The default comparator
 * uses `String.prototype.localeCompare`, which is suitable for string keys.
 *
 * @template K - The key type (defaults to `string`).
 * @template V - The value type (defaults to `unknown`).
 */
export class OrderedMap<K = string, V = unknown> {
	#sortedKeys: Array<K>;
	#map: Map<K, V>;
	#compareFn: CompareFn<K>;

	public constructor(
		initialMap?: Iterable<[K, V]>,
		compareFn?: CompareFn<K>,
	) {
		this.#sortedKeys = [];
		this.#map = new Map(initialMap);
		this.#compareFn = compareFn ??
			// deno-lint-ignore no-explicit-any
			((a: string, b: string) => a.localeCompare(b)) as any;
	}

	/** The number of entries currently stored in the map. */
	public get size(): number {
		return this.#sortedKeys.length;
	}

	/** Removes all entries from the map. */
	public clear(): void {
		this.#sortedKeys = [];
		this.#map.clear();
	}

	/**
	 * Removes the entry with the given `key`.
	 *
	 * @param key - The key to remove.
	 * @returns `true` if the entry existed and was removed, `false` otherwise.
	 */
	public delete(key: K): boolean {
		if (this.#map.has(key)) {
			const i = this.#sortedKeys.indexOf(key);
			this.#sortedKeys.splice(i, 1);
			this.#map.delete(key);
			return true;
		}
		return false;
	}

	/**
	 * Returns an iterator over `[key, value]` pairs in ascending key order.
	 */
	public *entries(): IterableIterator<[K, V]> {
		for (const key of this.keys()) {
			const value = this.#map.get(key)!;
			yield [key, value];
		}
	}

	/**
	 * Calls `callbackFn` once for each entry in ascending key order.
	 *
	 * @param callbackFn - Function called with `(value, key, orderedMap)`.
	 * @param thisArg - Optional `this` binding for `callbackFn`.
	 */
	public forEach(
		callbackFn: (value: V, key: K, orderedMap: OrderedMap<K, V>) => void,
		thisArg?: unknown,
	): void {
		for (const [key, value] of this.entries()) {
			callbackFn.call(thisArg, value, key, this);
		}
	}

	/**
	 * Returns the value associated with `key`, or `undefined` if not present.
	 *
	 * @param key - The key to look up.
	 */
	public get(key: K): V | undefined {
		return this.#map.get(key);
	}

	/**
	 * Returns `true` if the map contains an entry with the given `key`.
	 *
	 * @param key - The key to test.
	 */
	public has(key: K): boolean {
		return this.#map.has(key);
	}

	/** Returns an iterator over all keys in ascending order. */
	public *keys(): IterableIterator<K> {
		for (const key of this.#sortedKeys) {
			yield key;
		}
	}

	/**
	 * Inserts or updates the entry for `key`.
	 *
	 * New keys are inserted at the correct sorted position determined by the
	 * comparator.  Existing keys are updated in-place without changing order.
	 *
	 * @param key - The key to insert or update.
	 * @param value - The value to associate with `key`.
	 * @returns `this` for chaining.
	 */
	public set(key: K, value: V): this {
		if (!this.has(key)) {
			const i = this.#sortedKeys.findIndex((k) => this.#compareFn(k, key) > 0);
			if (i === -1) {
				this.#sortedKeys.push(key);
			} else {
				this.#sortedKeys.splice(i, 0, key);
			}
		}
		this.#map.set(key, value);
		return this;
	}

	/** Returns an iterator over all values in ascending key order. */
	public *values(): IterableIterator<V> {
		for (const [_, value] of this.entries()) {
			yield value;
		}
	}

	/** Makes the map iterable; yields `[key, value]` pairs in ascending key order. */
	public *[Symbol.iterator](): IterableIterator<[K, V]> {
		yield* this.entries();
	}
}

export default OrderedMap;
