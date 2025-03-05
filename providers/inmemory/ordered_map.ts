export type CompareFn<K> = (a: K, b: K) => number;

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

	public get size(): number {
		return this.#sortedKeys.length;
	}

	public clear(): void {
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
		for (const key of this.#sortedKeys) {
			yield key;
		}
	}

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
