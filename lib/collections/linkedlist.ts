const PREV = Symbol("LinkedListNode#prev");
const NEXT = Symbol("LinkedListNode#next");

export class LinkedList<T = unknown> {
	#tail: LinkedListNode<T> | null = null;
	#head: LinkedListNode<T> | null = null;

	public constructor();
	public constructor(initialList: Iterable<T>);
	public constructor(
		initialList?: Iterable<T>,
	) {
		if (initialList) {
			for (const value of initialList) {
				this.addLast(value);
			}
		}
	}

	get size(): number {
		let size = 0;
		for (let node = this.#head; node; node = node[NEXT]) {
			size++;
		}
		return size;
	}

	public clear(): void {
		this.#tail = null;
		this.#head = null;
	}

	public *values(): IterableIterator<T> {
		for (let node = this.#head; node; node = node[NEXT]) {
			yield node.value;
		}
	}

	public *[Symbol.iterator](): IterableIterator<T> {
		yield* this.values();
	}

	public forEach(
		callbackFn: (value: T, linkedList: LinkedList<T>) => void,
		thisArg?: unknown,
	): void {
		for (const value of this.values()) {
			callbackFn.call(thisArg, value, this);
		}
	}

	public contains(value: T): boolean {
		for (const v of this) {
			if (v === value) {
				return true;
			}
		}
		return false;
	}

	public findFirstNode(
		predicate: (value: T) => boolean,
	): LinkedListNode<T> | undefined {
		for (let node = this.#head; node; node = node[NEXT]) {
			if (predicate(node.value)) {
				return node;
			}
		}
		return undefined;
	}

	public findLastNode(
		predicate: (value: T) => boolean,
	): LinkedListNode<T> | undefined {
		for (let node = this.#tail; node; node = node[PREV]) {
			if (predicate(node.value)) {
				return node;
			}
		}
		return undefined;
	}

	public addLast(value: T): void {
		const node = new LinkedListNode(value, this.#tail, null);
		if (this.#tail) {
			this.#tail[NEXT] = node;
		}
		if (!this.#head) {
			this.#head = node;
		}
		this.#tail = node;
	}

	public addFirst(value: T): void {
		const node = new LinkedListNode(value, null, this.#head);
		if (this.#head) {
			this.#head[PREV] = node;
		}
		if (!this.#tail) {
			this.#tail = node;
		}
		this.#head = node;
	}

	public addBefore(
		node: LinkedListNode<T>,
		value: T,
	): void {
		const newNode = new LinkedListNode(value, node[PREV], node);
		node[PREV] = newNode;
		if (newNode[PREV]) {
			newNode[PREV][NEXT] = newNode;
		} else {
			this.#head = newNode;
		}
	}

	public addAfter(
		node: LinkedListNode<T>,
		value: T,
	): void {
		const newNode = new LinkedListNode(value, node, node[NEXT]);
		node[NEXT] = newNode;
		if (newNode[NEXT]) {
			newNode[NEXT][PREV] = newNode;
		} else {
			this.#tail = newNode;
		}
	}

	public removeFirst(): T | undefined {
		if (!this.#head) {
			return undefined;
		}
		const node = this.#head;
		this.#head = node[NEXT];
		if (this.#head) {
			this.#head[PREV] = null;
		} else {
			this.#tail = null;
		}
		return node.value;
	}

	public removeLast(): T | undefined {
		if (!this.#tail) {
			return undefined;
		}
		const node = this.#tail;
		this.#tail = node[PREV];
		if (this.#tail) {
			this.#tail[NEXT] = null;
		} else {
			this.#head = null;
		}
		return node.value;
	}

	public removeNode(node: LinkedListNode<T>): T | undefined {
		if (node === this.#head) {
			return this.removeFirst();
		}
		if (node === this.#tail) {
			return this.removeLast();
		}
		if (node[PREV]) {
			node[PREV][NEXT] = node[NEXT];
		}
		if (node[NEXT]) {
			node[NEXT][PREV] = node[PREV];
		}
		return node.value;
	}
}

export class LinkedListNode<T> {
	public value: T;
	[PREV]: LinkedListNode<T> | null = null;
	[NEXT]: LinkedListNode<T> | null = null;

	public constructor(
		value: T,
		prev: LinkedListNode<T> | null = null,
		next: LinkedListNode<T> | null = null,
	) {
		this.value = value;
		this[PREV] = prev;
		this[NEXT] = next;
	}
}

export default LinkedList;
