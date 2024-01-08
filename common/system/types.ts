export type PartialRequired<T, K extends keyof T> =
	& Pick<T, K>
	& Partial<Omit<T, K>>;

export type Pretty<U> = U extends infer O ? { [K in keyof O]: O[K] } : never;
