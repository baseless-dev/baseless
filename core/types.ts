export type PartialRequired<T, K extends keyof T> =
	& Pick<T, K>
	& Partial<Omit<T, K>>;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type MaybePromise<T> = T | Promise<T>;

export type MaybeCallable<T, TArgs extends unknown[] = []> =
	| T
	| ((...args: TArgs) => T);

export type First<Value extends unknown[]> = Value extends
	[infer Item, ...unknown[]] ? Item : never;

export type Last<Value extends unknown[]> = Value extends
	[...unknown[], infer Item] ? Item : never;

export type Split<Value extends string, Sep extends string> = Value extends
	`${infer A}${Sep}${infer B}` ? [A, ...Split<B, Sep>]
	: [Value];

export type UnionOmit<T, K extends string | number | symbol> = T extends unknown
	? Omit<T, K>
	: never;

// UnionToIntersection<A | B> = A & B
export type UnionToIntersection<U> = (
	U extends unknown ? (arg: U) => 0 : never
) extends (arg: infer I) => 0 ? I
	: never;

// LastInUnion<A | B> = B
export type LastInUnion<U> = UnionToIntersection<
	U extends unknown ? (x: U) => 0 : never
> extends (x: infer L) => 0 ? L
	: never;

// UnionToTuple<A, B> = [A, B]
export type UnionToTuple<T, Last = LastInUnion<T>> = [T] extends [never] ? []
	: [Last, ...UnionToTuple<Exclude<T, Last>>];
