import { NoopServiceError } from "./mod.ts";

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

/**
 * KV service backed by a IKVProvider
 */
export class KVService implements IKVService {
	/**
	 * Construct a new KVService backed by an IKVProvider
	 */
	constructor(protected backend: IKVProvider) {}

	/**
	 * Retrieve a single key
	 */
	get<Metadata>(
		key: string,
		options?: KVGetOptions,
	): Promise<IKVValue<Metadata>> {
		return this.backend.get(key, options);
	}

	/**
	 * Retrieve keys at prefix
	 */
	list<Metadata>(
		prefix: string,
		filter?: KVScanFilter<Metadata>,
	): Promise<IKVValue<Metadata>[]> {
		return this.backend.list(prefix, filter);
	}

	/**
	 * Set a key
	 */
	set<Metadata>(
		key: string,
		metadata: Metadata,
		data?: KVData,
		options?: KVSetOptions,
	): Promise<void> {
		return this.backend.set(key, metadata, data, options);
	}

	/**
	 * Delete a key
	 */
	delete(key: string): Promise<void> {
		return this.backend.delete(key);
	}
}

/**
 * Noop KV service backed by a IKVProvider
 */
export class NoopKVService implements IKVService {
	/**
	 * Retrieve a single key
	 */
	get<Metadata>(): Promise<IKVValue<Metadata>> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Retrieve keys at prefix
	 */
	list<Metadata>(): Promise<IKVValue<Metadata>[]> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Set a key
	 */
	set(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Delete a key
	 */
	delete(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}
}
