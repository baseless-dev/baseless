import { type TObject, type TString, Type } from "@sinclair/typebox";

export function isPathMatching<T extends string[]>(a: T, b?: unknown[]): b is T {
	if (!b || !Array.isArray(b) || a.length !== b.length) {
		return false;
	}
	return a.every((v, i) => v === b[i]);
}

export interface TreeNodeConst<TLeaf> {
	kind: "const";
	value: string;
	children?: TreeNode<TLeaf>[];
}

export interface TreeNodeVariable<TLeaf> {
	kind: "variable";
	name: string;
	children?: TreeNode<TLeaf>[];
}

export interface TreeNodeLeaf<TLeaf> {
	kind: "leaf";
	values: TLeaf[];
}

export type TreeNode<TLeaf> = TreeNodeConst<TLeaf> | TreeNodeVariable<TLeaf> | TreeNodeLeaf<TLeaf>;

export function isTreeNodeMatching<TLeaf>(nodeA: TreeNode<TLeaf>, nodeB: TreeNode<TLeaf>): boolean {
	if (nodeA.kind !== nodeB.kind) {
		return false;
	}
	if (nodeA.kind === "const") {
		return nodeA.value === (nodeB as TreeNodeConst<TLeaf>).value;
	}
	return true;
}

export function pathToTreeNode<TLeaf = unknown>(path: string[], value?: TLeaf): TreeNode<TLeaf> {
	const rootNode: TreeNode<TLeaf> = { kind: "const", value: "" };
	let parentNode: TreeNode<TLeaf> = rootNode;
	for (const segment of path) {
		let node: TreeNode<TLeaf>;
		if (segment.startsWith("{") && segment.endsWith("}")) {
			node = { kind: "variable", name: segment.slice(1, -1) };
		} else {
			node = { kind: "const", value: segment };
		}
		parentNode.children = [node];
		parentNode = node;
	}
	parentNode.children ??= [];
	parentNode.children.push({ kind: "leaf", values: [value!] });
	return rootNode.children?.at(0)!;
}

export function mergeTreeNodes<TLeaf>(treeNodes: TreeNode<TLeaf>[]): TreeNode<TLeaf>[] {
	const merged: TreeNode<TLeaf>[] = [];
	for (const treeNode of treeNodes) {
		const existing = merged.find((node) => isTreeNodeMatching(node, treeNode));
		if (!existing) {
			merged.push(treeNode);
		} else if (existing.kind === "const" && treeNode.kind === "const") {
			existing.children = mergeTreeNodes([
				...existing.children ?? [],
				...treeNode.children ?? [],
			]);
		} else if (existing.kind === "variable" && treeNode.kind === "variable") {
			existing.children = mergeTreeNodes([
				...existing.children ?? [],
				...treeNode.children ?? [],
			]);
		} else if (existing.kind === "leaf" && treeNode.kind === "leaf") {
			existing.values = [
				...existing.values,
				...treeNode.values,
			];
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
	if (a.kind === "leaf" && b.kind !== "leaf") {
		return 1;
	}
	if (a.kind !== "leaf" && b.kind === "leaf") {
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
	items: ReadonlyArray<T>,
): PathMatcher<T> {
	const forest = mergeTreeNodes(items.map((item) => pathToTreeNode(item.path, item)));
	return function* (key): IterableIterator<T> {
		const path = [...key];
		let haystack: TreeNode<T>[] = forest;
		let treeNode: TreeNode<T> | undefined;
		for (let segment = path.shift(); segment; segment = path.shift()) {
			treeNode = haystack.find((treeNode) =>
				(treeNode.kind === "const" && treeNode.value === segment) ||
				treeNode.kind === "variable"
			);
			if (!treeNode) {
				break;
			}
			if (treeNode.kind !== "leaf") {
				haystack = treeNode.children ?? [];
			}
		}
		if (treeNode && treeNode.kind !== "leaf") {
			for (const node of treeNode.children ?? []) {
				if (node.kind === "leaf") {
					yield* node.values;
				}
			}
		}
	};
}

export type ReplaceVariableInPathSegment<TPath extends string[]> =
	& {
		[K in keyof TPath]: TPath[K] extends `{${string}}` ? `${string}` : TPath[K];
	}
	& { length: TPath["length"] };

export type ExtractParamInPath<TPath extends string[]> = {
	[K in keyof TPath]: TPath[K] extends `{${infer Name}}` ? Name : never;
};

export type PathAsType<TPath extends string[]> = {
	[param in ExtractParamInPath<TPath>[number]]: string;
};

export function PathAsType<const TPath extends string[]>(
	pattern: TPath,
	path: string[],
): PathAsType<TPath> {
	const props: Record<string, string> = {};
	for (let i = 0, l = pattern.length; i < l; ++i) {
		const segment = pattern[i];
		if (segment.startsWith("{") && segment.endsWith("}")) {
			props[segment.slice(1, -1)] = path.at(i)!;
		}
	}
	return props as never;
}

export type PathAsSchema<TPath extends string[]> = TObject<
	{
		[param in ExtractParamInPath<TPath>[number]]: TString;
	}
>;

export function PathAsSchema<const TPath extends string[]>(path: TPath): PathAsSchema<TPath> {
	const props: Record<string, TString> = {};
	for (const segment of path) {
		if (segment.startsWith("{") && segment.endsWith("}")) {
			props[segment.slice(1, -1)] = Type.String();
		}
	}
	return Type.Object(props) as never;
}

export type PathMatcher<T> = (path: string[]) => IterableIterator<T>;
