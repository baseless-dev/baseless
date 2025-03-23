export class LruCache<K, V> {
	#maxSize: number;
	#storage: Map<K, V>;

	constructor(maxSize: number, entries?: readonly (readonly [K, V])[]) {
		this.#maxSize = maxSize;
		this.#storage = new Map<K, V>(entries);
	}

	get(key: K): V | undefined {
		if (!this.#storage.has(key)) {
			return undefined;
		}
		const value = this.#storage.get(key)!;
		this.#storage.delete(key);
		this.#storage.set(key, value);
		return value;
	}

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
