import type { IKVValue, KVData, KVScanFilter } from "https://baseless.dev/x/shared/kv.ts";
import { NoopProviderError } from "./mod.ts";

export type { KVScanFilter } from "https://baseless.dev/x/shared/kv.ts";

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
 * Noop KV Provider
 *
 * @internal
 */
export class NoopKVProvider implements IKVProvider {
	get() {
		return Promise.reject(new NoopProviderError());
	}

	list() {
		return Promise.reject(new NoopProviderError());
	}

	set() {
		return Promise.reject(new NoopProviderError());
	}

	delete() {
		return Promise.reject(new NoopProviderError());
	}
}
