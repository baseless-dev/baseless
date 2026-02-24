/**
 * Options for a KV `get` operation.
 */
export interface KVGetOptions {
	readonly cacheTtl: number;
}

/**
 * Options for a KV `list` operation.
 */
export interface KVListOptions {
	readonly prefix: string;
	readonly cursor?: string;
	readonly limit?: number;
}

/**
 * Options for a KV `put` operation.
 */
export type KVPutOptions = {
	/**
	 * Document will expire at specified date
	 */
	readonly expiration?: number | Date;
};

/**
 * A key-value entry including its stored `value` and optional expiration
 * timestamp (Unix milliseconds).
 */
export interface KVKey {
	readonly key: string;
	readonly expiration?: number;
	readonly value: unknown;
}

/**
 * A key name and optional expiration returned inside a {@link KVListResult}.
 */
export interface KVListKey {
	readonly key: string;
	readonly expiration?: number;
}

/**
 * The result of a KV `list` operation, containing matching keys and a
 * `next` cursor for pagination.
 */
export interface KVListResult {
	readonly keys: ReadonlyArray<KVListKey>;
	readonly done: boolean;
	readonly next?: string;
}
