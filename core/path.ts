// deno-lint-ignore-file ban-types
import { Trie } from "./trie.ts";
import type { Prettify } from "./prettify.ts";

// deno-fmt-ignore
type _PathToParams<TPath extends string> =
	TPath extends `:${infer Param}/${infer Rest}` ? { [K in Param]: string } & _PathToParams<Rest>
	: TPath extends `${string}/${infer Rest}` ? _PathToParams<Rest>
	: TPath extends `:${infer Param}` ? { [K in Param]: string }
	: {};

export type PathToParams<TPath> = TPath extends string ? Prettify<_PathToParams<TPath>> : never;

// deno-fmt-ignore
export type PathToTemplate<TPath extends string> =
	TPath extends `:${infer Param}/${infer Rest}` ? `${string}/${PathToTemplate<Rest>}`
	: TPath extends `${infer Head}/${infer Rest}` ? `${Head}/${PathToTemplate<Rest>}`
	: TPath extends `:${infer Param}` ? `${string}`
	: TPath;

export function convertPathToParams(path: string): string {
	const parts = path.split("/").filter((p) => p.startsWith(":"));
	return parts.length ? `{ ${parts.map((p) => p.slice(1)).join(": string; ")}: string }` : "{}";
}

export function convertPathToTemplate(path: string): string {
	const parts = path.split("/").map((p) => p.startsWith(":") ? "${string}" : p);
	return parts.join("/");
}

export function comparePaths(a: { path: string }, b: { path: string }): number {
	const partsA = a.path.split("/");
	const partsB = b.path.split("/");
	if (partsA.length < partsB.length) return -1;
	if (partsA.length > partsB.length) return 1;
	for (let i = 0, l = partsA.length; i < l; i++) {
		if (partsA[i].startsWith(":") && partsB[i].startsWith(":")) continue;
		if (partsA[i].startsWith(":")) return 1;
		if (partsB[i].startsWith(":")) return 1;
		const r = partsA[i].localeCompare(partsB[i]);
		if (r !== 0) return r;
	}
	return 0;
}

export type Matcher<TMatch extends { path: string }> = (
	path: string,
) => IterableIterator<[params: Record<string, string>, matchable: TMatch]>;

export function matchPath<TMatchables extends { path: string }>(
	matchables: Array<TMatchables>,
): Matcher<TMatchables> {
	if (matchables.length > 20) {
		return matchPathTrie(matchables);
	}
	return matchPathRegex(matchables);
}

export function matchPathRegex<TMatchables extends { path: string }>(
	matchables: Array<TMatchables>,
): Matcher<TMatchables> {
	const regexes = matchables.map((m) => {
		const pattern = m.path.split("/").map((p) => p.startsWith(":") ? `(?<${p.slice(1)}>[^/$]+)` : p).join("/");
		return new RegExp(`^${pattern}$`);
	});
	return function* (path: string): IterableIterator<[params: Record<string, string>, matchable: TMatchables]> {
		for (let i = 0; i < regexes.length; i++) {
			const match = path.match(regexes[i]);
			if (match) {
				yield [{ ...match.groups }, matchables[i] as TMatchables] as const;
			}
		}
	};
}

export function matchPathTrie<TMatchables extends { path: string }>(
	matchables: Array<TMatchables>,
): Matcher<TMatchables> {
	const tree = new Trie<TMatchables>();
	for (const matchable of matchables) {
		tree.insert(matchable.path, matchable);
	}
	return function* (path: string): IterableIterator<[params: Record<string, string>, matchable: TMatchables]> {
		for (const [matchable, params] of tree.find(path)) {
			yield [params, matchable] as const;
		}
	};
}
