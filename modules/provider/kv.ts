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
 */
export class NoopKVProvider implements IKVProvider {
	/**
	 * Retrieve a single key
	 */
	get<Metadata>(): Promise<IKVValue<Metadata>> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Retrieve keys at prefix
	 */
	list<Metadata>(): Promise<IKVValue<Metadata>[]> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Set a key
	 */
	set(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Delete a key
	 */
	delete(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}
}
