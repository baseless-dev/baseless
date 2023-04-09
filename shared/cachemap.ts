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
		const expiration = typeof expireInAt === "undefined" ? undefined : expireInAt instanceof Date ? expireInAt.getTime() * 1000 : Date.now() + expireInAt;
		this.#map.set(key, { value, expiration });
	}

	delete(key: K) {
		this.#map.delete(key);
	}

	clearAll() {
		this.#map.clear();
	}

	clearExpired() {
		const now = Date.now();
		for (const [key, data] of this.#map) {
			if (data.expiration && data.expiration <= now) {
				this.#map.delete(key);
			}
		}
	}
}
