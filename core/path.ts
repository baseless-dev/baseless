export interface TreeNodeConst<TLeaf> {
	kind: "const";
	value: string;
	children?: TreeNode<TLeaf>[];
	leaf?: TLeaf;
}

export interface TreeNodeVariable<TLeaf> {
	kind: "variable";
	name: string;
	children?: TreeNode<TLeaf>[];
	leaf?: TLeaf;
}

export type TreeNode<TLeaf> = TreeNodeConst<TLeaf> | TreeNodeVariable<TLeaf>;

export function isTreeNodeMatching<TLeaf>(nodeA: TreeNode<TLeaf>, nodeB: TreeNode<TLeaf>): boolean {
	if (nodeA.kind !== nodeB.kind) {
		return false;
	}
	if (nodeA.kind === "const") {
		return nodeA.value === (nodeB as TreeNodeConst<TLeaf>).value;
	}
	return true;
}

export function pathToTreeNode<TLeaf = unknown>(path: string[], leaf?: TLeaf): TreeNode<TLeaf> {
	const rootNode: TreeNode<TLeaf> = { kind: "const", value: "" };
	let parentNode: TreeNode<TLeaf> = rootNode;
	let leafNode: TreeNode<TLeaf>;
	for (const segment of path) {
		let node: TreeNode<TLeaf>;
		if (segment.startsWith("{") && segment.endsWith("}")) {
			node = { kind: "variable", name: segment.slice(1, -1) };
		} else {
			node = { kind: "const", value: segment };
		}
		parentNode.children = [node];
		parentNode = node;
		leafNode = node;
	}
	if (leaf) {
		leafNode!.leaf = leaf;
	}
	return rootNode.children?.at(0)!;
}

export function mergeTreeNodes<TLeaf>(treeNodes: TreeNode<TLeaf>[]): TreeNode<TLeaf>[] {
	const merged: TreeNode<TLeaf>[] = [];
	for (const treeNode of treeNodes) {
		const existing = merged.find((node) => isTreeNodeMatching(node, treeNode));
		if (!existing) {
			merged.push(treeNode);
		} else {
			existing.children = mergeTreeNodes([
				...existing.children ?? [],
				...treeNode.children ?? [],
			]);
		}
	}
	merged.sort(treeNodeSorter);
	return merged;
}

export function treeNodeSorter<TLeaf>(a: TreeNode<TLeaf>, b: TreeNode<TLeaf>): number {
	if (a.kind === "const" && b.kind === "variable") {
		return -1;
	}
	if (a.kind === "variable" && b.kind === "const") {
		return 1;
	}
	if (a.kind === "const" && b.kind === "const") {
		return a.value.localeCompare(b.value);
	}
	return 0;
}

export function createPathMatcher<T extends { path: string[] }>(
	items: T[],
): (path: string[]) => T | undefined {
	const forest = mergeTreeNodes(items.map((item) => pathToTreeNode(item.path, item)));
	return (path) => {
		let searchNode: TreeNode<T> | undefined = pathToTreeNode(path);
		let haystack: TreeNode<T>[] = forest;
		let treeNode: TreeNode<T> | undefined;
		while (haystack.length && !!searchNode) {
			treeNode = haystack.find((treeNode) => isTreeNodeMatching(treeNode, searchNode!));
			if (!treeNode) {
				return undefined;
			}
			haystack = treeNode.children ?? [];
			searchNode = searchNode.children?.at(0)!;
		}
		return treeNode?.leaf;
	};
}
