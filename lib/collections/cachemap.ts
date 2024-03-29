import OrderedMap from "./orderedmap.ts";

export class CacheMap<V = unknown> {
	#map: OrderedMap<string, { value: V; expiration?: number }>;

	public constructor();
	public constructor(initialMap: Iterable<[string, V]>);
	public constructor(initialMap?: Iterable<[string, V]>) {
		this.#map = new OrderedMap(
			Array.from(initialMap ?? []).map(([key, value]) => [key, { value }]),
			(a: string, b: string) => a.localeCompare(b),
		);
	}

	public get size(): number {
		return this.#map.size;
	}

	public clear(): void {
		this.#map.clear();
	}

	public clearExpired(): void {
		const now = Date.now();
		for (const [key, data] of this.#map) {
			if (data.expiration && data.expiration <= now) {
				this.#map.delete(key);
			}
		}
	}

	public delete(key: string): boolean {
		return this.#map.delete(key);
	}

	public *entries(): IterableIterator<[string, V]> {
		for (const [key, data] of this.#map.entries()) {
			if (!data.expiration || data.expiration > Date.now()) {
				yield [key, data.value];
			}
		}
	}

	public forEach(
		callbackFn: (value: V, key: string, cacheMap: CacheMap<V>) => void,
		thisArg?: unknown,
	): void {
		for (const [key, value] of this.entries()) {
			callbackFn.call(thisArg, value, key, this);
		}
	}

	public get(key: string): V | undefined {
		const data = this.#map.get(key);
		if (data) {
			if (!data.expiration || data.expiration > Date.now()) {
				return data.value;
			}
			this.#map.delete(key);
		}
	}

	public has(key: string): boolean {
		const data = this.#map.get(key);
		if (data) {
			if (!data.expiration || data.expiration > Date.now()) {
				return true;
			}
			this.#map.delete(key);
		}
		return false;
	}

	public *keys(): IterableIterator<string> {
		for (const [key, _] of this.entries()) {
			yield key;
		}
	}

	public set(key: string, value: V, expireInAt?: number | Date): void {
		const expiration = typeof expireInAt === "undefined"
			? undefined
			: expireInAt instanceof Date
			? expireInAt.getTime() * 1000
			: Date.now() + expireInAt;
		this.#map.set(key, { value, expiration });
	}

	public *values(): IterableIterator<V> {
		for (const [_, value] of this.entries()) {
			yield value;
		}
	}

	public *[Symbol.iterator](): IterableIterator<[string, V]> {
		yield* this.entries();
	}
}

export default CacheMap;
