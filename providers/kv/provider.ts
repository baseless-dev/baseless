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
	readonly value: string;
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
export interface KVProvider {
	/**
	 * Retrieve a single key
	 */
	get(
		key: string[],
		options?: KVGetOptions,
	): Promise<KVKey>;

	/**
	 * Put a key
	 */
	put(
		key: string[],
		value: string,
		options?: KVPutOptions,
	): Promise<void>;

	/**
	 * Retrieve keys at prefix
	 */
	list(options: KVListOptions): Promise<KVListResult>;

	/**
	 * Delete a key
	 */
	delete(key: string[]): Promise<void>;
}
