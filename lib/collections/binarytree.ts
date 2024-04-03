const LEFT = Symbol("BinaryTreeNode#left");
const RIGHT = Symbol("BinaryTreeNode#right");

export type CompareFn<T> = (a: T, b: T) => number;

export class BinaryTree<T = string> {
	#root: BinaryTreeNode<T> | null = null;
	#compareFn: CompareFn<T>;

	public constructor();
	public constructor(compareFn: CompareFn<T>);
	public constructor(compareFn: CompareFn<T>, initialList: Iterable<T>);
	public constructor(
		compareFn?: CompareFn<T>,
		initialList?: Iterable<T>,
	) {
		this.#compareFn = compareFn ??
			((a: string, b: string) => a.localeCompare(b)) as any;
		if (initialList) {
			for (const value of initialList) {
				this.add(value);
			}
		}
	}

	get size(): number {
		let size = 0;
		for (const _ of this.values()) {
			size++;
		}
		return size;
	}

	public clear(): void {
		this.#root = null;
	}

	public add(value: T): void {
		if (!this.#root) {
			this.#root = new BinaryTreeNode(this.#compareFn, value);
		} else {
			this.#root.add(value);
		}
	}

	public contains(value: T): boolean {
		if (this.#root) {
			return this.#root.contains(value);
		}
		return false;
	}

	public remove(value: T): boolean {
		if (this.#root) {
			const result = this.#root.remove(value);
			if (result === undefined) {
				this.#root = null;
				return true;
			}
			return result;
		}
		return false;
	}

	public *values(): IterableIterator<T> {
		if (this.#root) {
			yield* this.#root.values();
		}
	}

	public *[Symbol.iterator](): IterableIterator<T> {
		yield* this.values();
	}

	public forEach(
		callbackFn: (value: T, tree: BinaryTree<T>) => void,
		thisArg?: unknown,
	): void {
		for (const value of this.values()) {
			callbackFn.call(thisArg, value, this);
		}
	}
}

export class BinaryTreeNode<T = unknown> {
	#compareFn: CompareFn<T>;
	#value: T;
	[LEFT]: BinaryTreeNode<T> | null = null;
	[RIGHT]: BinaryTreeNode<T> | null = null;

	public constructor(
		compareFn: CompareFn<T>,
		value: T,
		left: BinaryTreeNode<T> | null = null,
		right: BinaryTreeNode<T> | null = null,
	) {
		this.#compareFn = compareFn;
		this.#value = value;
		this[LEFT] = left;
		this[RIGHT] = right;
	}

	public add(value: T): void {
		const comparison = this.#compareFn(value, this.#value);
		if (comparison < 0) {
			if (this[LEFT]) {
				this[LEFT]!.add(value);
			} else {
				this[LEFT] = new BinaryTreeNode(this.#compareFn, value);
			}
		} else {
			if (this[RIGHT]) {
				this[RIGHT]!.add(value);
			} else {
				this[RIGHT] = new BinaryTreeNode(this.#compareFn, value);
			}
		}
	}

	public contains(value: T): boolean {
		if (this.#value === value) {
			return true;
		} else if (this[LEFT] && this.#compareFn(value, this.#value) < 0) {
			return this[LEFT]!.contains(value);
		} else if (this[RIGHT]) {
			return this[RIGHT]!.contains(value);
		}
		return false;
	}

	public remove(value: T): boolean | undefined {
		if (this.#value === value) {
			if (this[LEFT]) {
				this.#value = this[LEFT]!.#value;
				this[LEFT][RIGHT] = this[RIGHT];
				this[LEFT] = this[LEFT]![LEFT];
			} else if (this[RIGHT]) {
				this.#value = this[RIGHT]!.#value;
				this[RIGHT][LEFT] = this[LEFT];
				this[RIGHT] = this[RIGHT]![RIGHT];
			} else {
				return undefined;
			}
			return true;
		}
		if (this[LEFT] && this.#compareFn(value, this.#value) < 0) {
			const result = this[LEFT]!.remove(value);
			if (result === undefined) {
				this[LEFT] = null;
				return true;
			}
			return result;
		} else if (this[RIGHT]) {
			const result = this[RIGHT]!.remove(value);
			if (result === undefined) {
				this[RIGHT] = null;
				return true;
			}
			return result;
		}
		return false;
	}

	public *values(): IterableIterator<T> {
		yield this.#value;
		if (this[LEFT]) {
			yield* this[LEFT]!.values();
		}
		if (this[RIGHT]) {
			yield* this[RIGHT]!.values();
		}
	}

	public *[Symbol.iterator](): IterableIterator<T> {
		yield* this.values();
	}
}

export default BinaryTree;
