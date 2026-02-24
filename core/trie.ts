/**
 * A node in a prefix-trie data structure.
 * Supports `:param`-style dynamic segments and is used by
 * {@link matchPathTrie} for efficient URL routing.
 *
 * @template T The type of values stored at each node.
 */
export class TrieNode<T> {
	#children: Record<string, TrieNode<T>>;
	#values: T[];

	/** Returns a shallow copy of the child-node map keyed by path segment. */
	get children(): Record<string, TrieNode<T>> {
		return { ...this.#children };
	}

	/** Returns a copy of the values stored at this node. */
	get values(): ReadonlyArray<T> {
		return this.#values.slice();
	}

	constructor() {
		this.#children = {};
		this.#values = [];
	}

	/**
	 * Inserts `value` into the trie at `path`.
	 * Path segments are separated by `/`; segments starting with `:` are treated
	 * as named parameters and match any concrete segment at lookup time.
	 *
	 * @param path The path template (e.g. `"/users/:id"`).
	 * @param value The value to store at the path.
	 */
	insert(path: string, value: T): void {
		// deno-lint-ignore no-this-alias
		let node: TrieNode<T> = this;
		for (const part of path.split("/")) {
			let child = node.#children[part];
			if (!child) {
				child = new TrieNode<T>();
				node.#children[part] = child;
			}
			node = child;
		}
		node.#values.push(value);
	}

	/**
	 * Walks the trie to find all values whose path template matches `path`,
	 * yielding tuples of the matched value and extracted parameter record.
	 *
	 * @param path The concrete URL path to match (e.g. `"/users/usr_123"`).
	 * @yields `[value, params]` tuples for every matching stored value.
	 */
	*find(path: string): IterableIterator<[T, Record<string, string>]> {
		const parts = path.split("/");
		const length = parts.length;
		const searchNodes: Array<[TrieNode<T>, Record<string, string>]> = [[this, {}]];
		let params: Record<string, string> = {};
		let node: TrieNode<T> | undefined;
		for (let i = 0; searchNodes.length > 0 && i < length; ++i) {
			[node, params] = searchNodes.shift()!;
			const part = parts[i];
			for (const [key, child] of Object.entries(node.#children)) {
				if (key === part) {
					searchNodes.push([child, params]);
				} else if (key.startsWith(":")) {
					searchNodes.push([child, { ...params, [key.slice(1)]: part }]);
				}
			}
		}

		for (const [node, params] of searchNodes) {
			for (const value of node.values) {
				yield [value, params];
			}
		}
	}
}

/**
 * Root node of a trie — a convenience subclass of {@link TrieNode} that can
 * be instantiated directly to represent the root `/`.
 */
export class Trie<T> extends TrieNode<T> {
	constructor() {
		super();
	}
}
