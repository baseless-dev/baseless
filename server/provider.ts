import { type Document } from "@baseless/core/document";

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

export interface DocumentGetOptions {
	readonly consistency: "strong" | "eventual";
}

export interface DocumentListOptions {
	readonly prefix: string[];
	readonly cursor?: string;
	readonly limit?: number;
}

export type DocumentListEntry = {
	cursor: string;
	document: Document;
};

export interface DocumentAtomicsResult {
	ok: boolean;
}

export type DocumentAtomicCheck =
	| { type: "notExists"; readonly key: string[] }
	| { type: "match"; readonly key: string[]; readonly versionstamp: string };

export type DocumentAtomicOperation =
	| { type: "delete"; readonly key: string[] }
	| {
		type: "set";
		readonly key: string[];
		readonly data: unknown;
	};

export abstract class DocumentAtomic {
	protected readonly checks: Array<DocumentAtomicCheck>;
	protected readonly ops: Array<DocumentAtomicOperation>;

	constructor(
		checks: Array<DocumentAtomicCheck> = [],
		ops: Array<DocumentAtomicOperation> = [],
	) {
		this.checks = checks;
		this.ops = ops;
	}

	notExists(key: string[]): DocumentAtomic {
		this.checks.push({ type: "notExists", key });
		return this;
	}

	match(key: string[], versionstamp: string): DocumentAtomic {
		this.checks.push({ type: "match", key, versionstamp });
		return this;
	}

	set(key: string[], data: unknown): DocumentAtomic {
		this.ops.push({ type: "set", key, data });
		return this;
	}

	delete(key: string[]): DocumentAtomic {
		this.ops.push({ type: "delete", key });
		return this;
	}

	abstract commit(): Promise<DocumentAtomicsResult>;
}

export abstract class DocumentProvider {
	abstract get(
		key: string[],
		options?: DocumentGetOptions,
	): Promise<Document>;

	abstract getMany(
		keys: Array<string[]>,
		options?: DocumentGetOptions,
	): Promise<Array<Document>>;

	abstract list(
		options: DocumentListOptions,
	): AsyncIterableIterator<DocumentListEntry>;

	abstract create(
		key: string[],
		data: unknown,
	): Promise<void>;

	abstract update(
		key: string[],
		data: unknown,
	): Promise<void>;

	abstract delete(key: string[]): Promise<void>;

	abstract deleteMany(keys: Array<string[]>): Promise<void>;

	abstract atomic(): DocumentAtomic;
}

export class DocumentNotFoundError extends Error {}
export class DocumentCreateError extends Error {}
