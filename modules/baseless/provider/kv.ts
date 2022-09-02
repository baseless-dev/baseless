/**
 * Options when getting a key
 */
export interface KVGetOptions {
	cacheTtl: number;
}

/**
 * Options when listing keys
 */
export interface KVListOptions {
	prefix: string;
	cursor?: string;
	limit?: number;
	cacheTtl?: number;
}

/**
 * Options when setting a key in the kv
 */
export type KVPutOptions =
	| {
		/**
		 * Document will expire at specified date
		 */
		expireAt: Date;
	}
	| {
		/**
		 * Document will expire in specified seconds
		 */
		expireIn: number;
	};

/**
 * KV Key
 */
export interface KVKey {
	key: string;
	expiration?: number;
	value: string;
}

/**
 * KV List result
 */
export interface KVListResult {
	keys: ReadonlyArray<KVKey>;
	done: boolean;
	next?: string;
}

/**
 * KV Provider
 */
export interface KVProvider {
	/**
	 * Retrieve a single key
	 */
	get(
		key: string,
		options?: KVGetOptions,
	): Promise<KVKey>;

	/**
	 * Put a key
	 */
	put(
		key: string,
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
	delete(key: string): Promise<void>;
}

/**
 * Document not found error
 */
export class KeyNotFoundError extends Error {
	public name = "KeyNotFoundError";
	public constructor(key: string) {
		super(`Key not found at '${key}'.`);
	}
}
