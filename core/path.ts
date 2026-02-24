// deno-lint-ignore-file ban-types
import { Trie } from "./trie.ts";
import type { Prettify } from "./prettify.ts";

// deno-fmt-ignore
type _PathToParams<TPath extends string> =
	TPath extends `:${infer Param}/${infer Rest}` ? { [K in Param]: string } & _PathToParams<Rest>
	: TPath extends `${string}/${infer Rest}` ? _PathToParams<Rest>
	: TPath extends `:${infer Param}` ? { [K in Param]: string }
	: {};

/**
 * Extracts a record of named path parameters from a path template string.
 * Given `"/users/:id/posts/:postId"`, produces `{ id: string; postId: string }`.
 */
export type PathToParams<TPath> = TPath extends string ? Prettify<_PathToParams<TPath>> : never;

// deno-fmt-ignore
/**
 * Converts a typed path template string to a `string`-wildcard template type.
 * Given `"/users/:id"`, produces `\`/users/${string}\``.
 */
export type PathToTemplate<TPath extends string> =
	TPath extends `:${infer Param}/${infer Rest}` ? `${string}/${PathToTemplate<Rest>}`
	: TPath extends `${infer Head}/${infer Rest}` ? `${Head}/${PathToTemplate<Rest>}`
	: TPath extends `:${infer Param}` ? `${string}`
	: TPath;

/**
 * Returns a TypeScript type-expression string representing the params record
 * for the given path template (used for code generation).
 * @param path The path template string (e.g. `"/users/:id"`).
 * @returns A TypeScript string like `"{ id: string }"` or `"{}"` when no params.
 */
export function convertPathToParams(path: string): string {
	const parts = path.split("/").filter((p) => p.startsWith(":"));
	return parts.length ? `{ ${parts.map((p) => p.slice(1)).join(": string; ")}: string }` : "{}";
}

/**
 * Converts a path template to a TypeScript template-literal type string
 * suitable for use in type definitions (used for code generation).
 * @param path The path template string (e.g. `"/users/:id"`).
 * @returns A template string like `"/users/${string}"`.
 */
export function convertPathToTemplate(path: string): string {
	const parts = path.split("/").map((p) => p.startsWith(":") ? "${string}" : p);
	return parts.join("/");
}

/**
 * Comparator for route objects by specificity: routes with more segments come
 * first; within the same length, literal segments sort before parameterized ones.
 * Suitable for use with `Array.prototype.sort`.
 * @param a An object with a `path` property.
 * @param b An object with a `path` property.
 * @returns A negative, zero, or positive number.
 */
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

/**
 * A function returned by {@link matchPath} (or its variants) that tests a
 * concrete URL path against a list of matchable objects — yielding each match
 * as a tuple of extracted `params` and the matched `TMatch` object.
 */
export type Matcher<TMatch extends { path: string }> = (
	path: string,
) => IterableIterator<[params: Record<string, string>, matchable: TMatch]>;

/**
 * Builds a {@link Matcher} for an array of matchable objects.
 * Automatically selects a trie-based implementation for more than 20 routes
 * and a regex-based one otherwise.
 *
 * @param matchables Array of objects with a `path` template property.
 * @returns A {@link Matcher} function.
 */
export function matchPath<TMatchables extends { path: string }>(
	matchables: Array<TMatchables>,
): Matcher<TMatchables> {
	if (matchables.length > 20) {
		return matchPathTrie(matchables);
	}
	return matchPathRegex(matchables);
}

/**
 * Builds a regex-based {@link Matcher}. Iterates all regexes on each call;
 * suitable for small route sets (<= 20).
 *
 * @param matchables Array of objects with a `path` template property.
 * @returns A {@link Matcher} function.
 */
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

/**
 * Builds a trie-based {@link Matcher}. Performs O(k) matching where k is the
 * number of path segments; suitable for large route sets (> 20).
 *
 * @param matchables Array of objects with a `path` template property.
 * @returns A {@link Matcher} function.
 */
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
