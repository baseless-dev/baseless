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
export type KVPutOptions =
	| {
		/**
		 * Document will expire at specified date
		 */
		readonly expireAt: Date;
	}
	| {
		/**
		 * Document will expire in specified seconds
		 */
		readonly expireIn: number;
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
	 * @throw {@link KeyNotFoundError} This exception is thrown if the key is not found
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
