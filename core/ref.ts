import { PathToParams } from "@baseless/core/path";

declare const BRAND: unique symbol;

/**
 * A branded string representing a resolved path reference.
 * `TPath` is the path template used to validate the string at the type level.
 */
export type Reference<TPath = string> = string & { [BRAND]: TPath };

/**
 * Creates a typed {@link Reference} by replacing `:param` placeholders in a
 * path template with the corresponding values from `params`.
 *
 * @example
 * ```ts
 * const r = ref("/users/:id", { id: "usr_123" }); // "/users/usr_123"
 * ```
 *
 * @param path The path template string.
 * @param params An optional record of parameter values (required when the path has params).
 * @returns The resolved reference string.
 * @throws {@link InvalidReferenceError} When a required parameter is missing.
 */
export function ref<TPath extends string>(path: keyof PathToParams<TPath> extends never ? TPath : never): Reference<TPath>;
export function ref<TPath extends string>(
	path: keyof PathToParams<TPath> extends never ? never : TPath,
	params: PathToParams<TPath>,
): Reference<TPath>;
export function ref(path: never, params: never): Reference<string>;
export function ref(path: string, params?: Record<string, unknown>): Reference<string> {
	return path.replace(/:([a-zA-Z0-9_]+)/g, (_: unknown, key: string) => {
		if (!params || !(key in params)) {
			throw new InvalidReferenceError();
		}
		return (params as any)[key];
	}) as never;
}

/**
 * Checks whether `value` is a valid {@link Reference}, optionally constrained
 * to match the given `path` template pattern.
 * @param value The value to test (when called with one argument).
 * @param path An optional path template to match against (when called with two arguments).
 * @returns `true` if `value` is a string matching the optional path pattern.
 */
export function isReference(value: unknown): value is Reference;
export function isReference<TPath extends string, TParams = Record<string, unknown>>(
	path: TPath,
	value: unknown,
): value is Reference<TPath>;
export function isReference(value_or_path: unknown | string, value?: unknown): boolean {
	const path = typeof value !== "undefined" && !!value_or_path ? `${value_or_path}` : undefined;
	value = typeof value !== "undefined" ? value : value_or_path;
	return typeof value === "string" &&
		(!path || !!value.match(path.replace(/:([a-zA-Z0-9_]+)/g, "([a-zA-Z0-9_]+)")));
}

/**
 * Asserts that `value` is a valid {@link Reference}, optionally constrained
 * to match the given `path` template pattern.
 * @param value The value to assert (when called with one argument).
 * @param path An optional path template to match against (when called with two arguments).
 * @throws {@link InvalidReferenceError} When the assertion fails.
 */
export function assertReference(value: unknown): asserts value is Reference;
export function assertReference<TPath extends string, TParams = Record<string, unknown>>(
	path: TPath,
	value: unknown,
): asserts value is Reference<TPath>;
export function assertReference(value_or_path: unknown | string, value?: unknown): void {
	const path = typeof value !== "undefined" && !!value_or_path ? `${value_or_path}` : undefined;
	value = typeof value !== "undefined" ? value : value_or_path;
	if (!isReference(path!, value)) {
		throw new InvalidReferenceError();
	}
}

/** Error thrown when a value is not a valid {@link Reference}. */
export class InvalidReferenceError extends Error {}
