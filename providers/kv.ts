import { KVKeyNotFoundError, KVPutError } from "../common/kv/errors.ts";
import { PromisedResult } from "../common/system/result.ts";

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
	readonly prefix: string;
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
	readonly key: string;
	readonly expiration?: number;
	readonly value: string;
}

/**
 * KV List result
 */
export interface KVListResult {
	readonly keys: ReadonlyArray<KVKey>;
	readonly done: boolean;
	readonly next?: string;
}

/**
 * KV Provider
 */
export interface KVProvider {
	/**
	 * Retrieve a single key
	 *
	 * @throw {@link KVKeyNotFoundError} This exception is thrown if the key is not found
	 */
	get(
		key: string,
		options?: KVGetOptions,
	): PromisedResult<KVKey, KVKeyNotFoundError>;

	/**
	 * Put a key
	 */
	put(
		key: string,
		value: string,
		options?: KVPutOptions,
	): PromisedResult<void, KVPutError>;

	/**
	 * Retrieve keys at prefix
	 */
	list(options: KVListOptions): PromisedResult<KVListResult, never>;

	/**
	 * Delete a key
	 */
	delete(key: string): PromisedResult<void, KVKeyNotFoundError>;
}
