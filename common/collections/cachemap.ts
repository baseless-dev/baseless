export class CacheMap<K, V> {
	#map: Map<K, { value: V; expiration?: number }>;

	constructor(entries?: readonly (readonly [K, V])[] | null) {
		this.#map = new Map(entries?.map(([key, value]) => [key, { value }]));
	}

	get(key: K): V | undefined {
		const data = this.#map.get(key);
		if (data) {
			if (!data.expiration || data.expiration > Date.now()) {
				return data.value;
			}
			this.#map.delete(key);
		}
	}

	set(key: K, value: V, expireInAt?: number | Date): void {
		const expiration = typeof expireInAt === "undefined"
			? undefined
			: expireInAt instanceof Date
			? expireInAt.getTime() * 1000
			: Date.now() + expireInAt;
		this.#map.set(key, { value, expiration });
	}

	delete(key: K): void {
		this.#map.delete(key);
	}

	*entries(): IterableIterator<[K, V]> {
		for (const [key, data] of this.#map.entries()) {
			if (!data.expiration || data.expiration > Date.now()) {
				yield [key, data.value];
			}
		}
	}

	keys(): IterableIterator<K> {
		return this.#map.keys();
	}

	*values(): IterableIterator<V> {
		for (const data of this.#map.values()) {
			if (!data.expiration || data.expiration > Date.now()) {
				yield data.value;
			}
		}
	}

	[Symbol.iterator](): IterableIterator<[K, V]> {
		return this.entries();
	}

	clearAll(): void {
		this.#map.clear();
	}

	clearExpired(): void {
		const now = Date.now();
		for (const [key, data] of this.#map) {
			if (data.expiration && data.expiration <= now) {
				this.#map.delete(key);
			}
		}
	}
}
