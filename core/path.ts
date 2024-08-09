import { type TObject, type TString, Type } from "@sinclair/typebox";

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
	items: ReadonlyArray<T>,
): PathMatcher<T> {
	const forest = mergeTreeNodes(items.map((item) => pathToTreeNode(item.path, item)));
	return (key) => {
		const path = [...key];
		let haystack: TreeNode<T>[] = forest;
		let treeNode: TreeNode<T> | undefined;
		for (let segment = path.shift(); segment; segment = path.shift()) {
			treeNode = haystack.find((treeNode) =>
				(treeNode.kind === "const" && treeNode.value === segment) ||
				treeNode.kind === "variable"
			);
			if (!treeNode) {
				return undefined;
			}
			haystack = treeNode.children ?? [];
		}
		return treeNode?.leaf;
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

// deno-fmt-ignore
export type PathAsString<TPath extends string[]> =
	TPath extends [infer Head]
	? Head extends string
		? Head extends `{${string}}`
			? `%`
			: Head
		: ""
	: TPath extends [infer Head, ...infer Tail]
		? Head extends string
			? Tail extends string[]
				? Head extends `{${string}}`
					? `%/${PathAsString<Tail>}`
					: `${Head}/${PathAsString<Tail>}`
				: ""
			: ""
		: "";

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

// deno-fmt-ignore
type _PathAsObject<TPath extends any[], T> = 
	TPath extends []
		? T
		: TPath extends [infer Head]
			? Head extends `{${string}}`
				? Record<string, T>
				: Head extends string
					? { [K in Head]: T }
					: never
			: TPath extends [infer Head, ...infer Tail]
				? Head extends `{${string}}`
					? Record<string, _PathAsObject<Tail, T>>
					: Head extends string
						? { [K in Head]: _PathAsObject<Tail, T> }
						: never
				: never;

export type PathAsObject<T extends { path: string[] }> = _PathAsObject<T["path"], T>;

export type PathMatcher<T> = (
	path: string[],
) => T | undefined;
