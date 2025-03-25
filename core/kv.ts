export interface KVGetOptions {
	readonly cacheTtl: number;
}

export interface KVListOptions {
	readonly prefix: string;
	readonly cursor?: string;
	readonly limit?: number;
}

export type KVPutOptions = {
	/**
	 * Document will expire at specified date
	 */
	readonly expiration?: number | Date;
};

export interface KVKey {
	readonly key: string;
	readonly expiration?: number;
	readonly value: unknown;
}

export interface KVListKey {
	readonly key: string;
	readonly expiration?: number;
}

export interface KVListResult {
	readonly keys: ReadonlyArray<KVListKey>;
	readonly done: boolean;
	readonly next?: string;
}
