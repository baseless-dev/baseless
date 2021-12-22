/**
 * Type alias for string | ReadableStream | ArrayBuffer
 */
export type KVData = null | string | ReadableStream | ArrayBuffer;

/**
 * KVValue object
 */
export interface IKVValue<Metadata> {
	/**
	 * Key of the value
	 */
	key: string;

	/**
	 * Metadata of the value
	 */
	metadata: Metadata;

	/**
	 * Retrieve the underlying value's data
	 */
	data(): Promise<KVData>;
}

/**
 * Options when getting a value from the kv
 */
export type KVGetOptions = { cacheTtl: number };

/**
 * Options when setting a key in the kv
 */
export type KVSetOptions =
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
 * Filter operator
 */
export type KVScanFilterOp<T> =
	| { eq: T }
	| { neq: T }
	| { gt: T }
	| { gte: T }
	| { lt: T }
	| { lte: T }
	| { in: T[] }
	| { nin: T[] };

/**
 * Filter object
 */
export type KVScanFilter<Model> = {
	[key in keyof Model]: KVScanFilterOp<Model[key]>;
};

/**
 * KV Provider
 */
export interface IKVProvider {
	/**
	 * Retrieve a single key
	 */
	get<Metadata>(
		key: string,
		options?: KVGetOptions,
	): Promise<IKVValue<Metadata>>;

	/**
	 * Retrieve keys at prefix
	 */
	list<Metadata>(
		prefix: string,
		filter?: KVScanFilter<Metadata>,
	): Promise<IKVValue<Metadata>[]>;

	/**
	 * Set a key
	 */
	set<Metadata>(
		key: string,
		metadata: Metadata,
		data?: KVData,
		options?: KVSetOptions,
	): Promise<void>;

	/**
	 * Delete a key
	 */
	delete(key: string): Promise<void>;
}

/**
 * Key-value service
 */
export interface IKVService {
	/**
	 * Retrieve a single key
	 */
	get<Metadata>(
		key: string,
		options?: KVGetOptions,
	): Promise<IKVValue<Metadata>>;

	/**
	 * Retrieve keys at prefix
	 */
	list<Metadata>(
		prefix: string,
		filter?: KVScanFilter<Metadata>,
	): Promise<IKVValue<Metadata>[]>;

	/**
	 * Set a key
	 */
	set<Metadata>(
		key: string,
		metadata: Metadata,
		data?: KVData,
		options?: KVSetOptions,
	): Promise<void>;

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
