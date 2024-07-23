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
