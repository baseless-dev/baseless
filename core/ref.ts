import { PathToParams } from "@baseless/core/path";

declare const BRAND: unique symbol;

export type Reference<TPath = string> = string & { [BRAND]: TPath };

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

export class InvalidReferenceError extends Error {}
