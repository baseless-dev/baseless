/**
 * Utility type that flattens an intersection type into a single object type,
 * making IDE tooltips more readable.
 *
 * @example
 * ```ts
 * type A = { a: string } & { b: number };
 * type B = Prettify<A>; // { a: string; b: number }
 * ```
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};
