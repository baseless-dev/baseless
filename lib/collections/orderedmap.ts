export type CompareFn<K> = (a: K, b: K) => number;

export class OrderedMap<K = string, V = unknown> {
	#sortedKeys: Array<K>;
	#map: Map<K, V>;
	#compareFn: CompareFn<K>;
	#needSorting: boolean;

	public constructor();
	public constructor(initialMap: Iterable<[K, V]>, compareFn: CompareFn<K>);
	public constructor(
		initialMap?: Iterable<[K, V]>,
		compareFn?: CompareFn<K>,
	) {
		this.#sortedKeys = [];
		this.#needSorting = true;
		this.#map = new Map(initialMap);
		this.#compareFn = compareFn ??
			((a: string, b: string) => a.localeCompare(b)) as any;
	}

	#sortKeys(): void {
		if (this.#needSorting) {
			this.#sortedKeys.sort(this.#compareFn);
			this.#needSorting = false;
		}
	}

	public get size(): number {
		return this.#sortedKeys.length;
	}

	public clear(): void {
		this.#needSorting = false;
		this.#sortedKeys = [];
		this.#map.clear();
	}

	public delete(key: K): boolean {
		if (this.#map.has(key)) {
			const i = this.#sortedKeys.indexOf(key);
			this.#sortedKeys.splice(i, 1);
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
		callbackFn: (value: V, key: K, orderedMap: OrderedMap<K, V>) => void,
		thisArg?: unknown,
	): void {
		for (const [key, value] of this.entries()) {
			callbackFn.call(thisArg, value, key, this);
		}
	}

	public get(key: K): V | undefined {
		return this.#map.get(key);
	}

	public has(key: K): boolean {
		return this.#map.has(key);
	}

	public *keys(): IterableIterator<K> {
		this.#sortKeys();
		for (const key of this.#sortedKeys) {
			yield key;
		}
	}

	public set(key: K, value: V): void {
		if (!this.has(key)) {
			this.#needSorting = true;
			this.#sortedKeys.push(key);
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

export default OrderedMap;
