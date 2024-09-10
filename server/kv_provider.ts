/**
 * Options when getting a key
 */
export interface KVGetOptions {
	readonly cacheTtl: number;
}

/**
 * Options when listing keys
 */
export interface KVListOptions {
	readonly prefix: string[];
	readonly cursor?: string;
	readonly limit?: number;
}

/**
 * Options when setting a key in the kv
 */
export type KVPutOptions = {
	/**
	 * Document will expire at specified date
	 */
	readonly expiration?: number | Date;
};

/**
 * KV Key
 */
export interface KVKey {
	readonly key: string[];
	readonly expiration?: number;
	readonly value: unknown;
}

/**
 * KV List Key
 */
export interface KVListKey {
	readonly key: string[];
	readonly expiration?: number;
}

/**
 * KV List result
 */
export interface KVListResult {
	readonly keys: ReadonlyArray<KVListKey>;
	readonly done: boolean;
	readonly next?: string;
}

/**
 * KV Provider
 */
export abstract class KVProvider {
	/**
	 * Retrieve a single key
	 */
	abstract get(
		key: string[],
		options?: KVGetOptions,
	): Promise<KVKey>;

	/**
	 * Put a key
	 */
	abstract put(
		key: string[],
		value: unknown,
		options?: KVPutOptions,
	): Promise<void>;

	/**
	 * Retrieve keys at prefix
	 */
	abstract list(options: KVListOptions): Promise<KVListResult>;

	/**
	 * Delete a key
	 */
	abstract delete(key: string[]): Promise<void>;
}

export class KVKeyNotFoundError extends Error {}
export class KVPutError extends Error {}
