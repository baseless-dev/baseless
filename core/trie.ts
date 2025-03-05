export class TrieNode<T> {
	#children: Record<string, TrieNode<T>>;
	#values: T[];

	get children(): Record<string, TrieNode<T>> {
		return { ...this.#children };
	}

	get values(): ReadonlyArray<T> {
		return this.#values.slice();
	}

	constructor() {
		this.#children = {};
		this.#values = [];
	}

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

export class Trie<T> extends TrieNode<T> {
	constructor() {
		super();
	}
}
