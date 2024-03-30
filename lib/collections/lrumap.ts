export class LRUMap<K = string, V = unknown> {
	#keyStack: Array<K>;
	#capacity: number;
	#map: Map<K, V>;

	public constructor(capacity: number);
	public constructor(capacity: number, initialMap: Iterable<[K, V]>);
	public constructor(
		capacity: number,
		initialMap?: Iterable<[K, V]>,
	) {
		this.#capacity = capacity;
		this.#keyStack = [];
		this.#map = new Map(initialMap);
	}

	public get size(): number {
		return this.#map.size;
	}

	public get capacity(): number {
		return this.#capacity;
	}

	public clear(): void {
		this.#keyStack = [];
		this.#map.clear();
	}

	public delete(key: K): boolean {
		if (this.#map.has(key)) {
			const i = this.#keyStack.indexOf(key);
			this.#keyStack.splice(i, 1);
			this.#map.delete(key);
			return true;
		}
		return false;
	}

	public *entries(): IterableIterator<[K, V]> {
		for (const key of this.keys()) {
			const value = this.#map.get(key)!;
			yield [key, value];
		}
	}

	public forEach(
		callbackFn: (value: V, key: K, orderedMap: LRUMap<K, V>) => void,
		thisArg?: unknown,
	): void {
		for (const [key, value] of this.entries()) {
			callbackFn.call(thisArg, value, key, this);
		}
	}

	public get(key: K): V | undefined {
		const i = this.#keyStack.indexOf(key);
		if (i > 0) {
			this.#keyStack.splice(i, 1);
			this.#keyStack.unshift(key);
		}
		return this.#map.get(key);
	}

	public has(key: K): boolean {
		return this.#map.has(key);
	}

	public *keys(): IterableIterator<K> {
		for (const key of this.#map.keys()) {
			yield key;
		}
	}

	public set(key: K, value: V): void {
		if (!this.has(key)) {
			if (this.size >= this.capacity) {
				const luKey = this.#keyStack.pop();
				if (luKey) {
					this.#map.delete(luKey);
				} else {
					throw new LruMapOverCapacityError();
				}
			}
			this.#keyStack.unshift(key);
		}
		this.#map.set(key, value);
	}

	public *values(): IterableIterator<V> {
		for (const [_, value] of this.entries()) {
			yield value;
		}
	}

	public *[Symbol.iterator](): IterableIterator<[K, V]> {
		yield* this.entries();
	}
}

export class LruMapOverCapacityError extends Error {
	public constructor() {
		super("LRUMap over capacity");
	}
}

export default LRUMap;
