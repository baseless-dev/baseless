import type {
	Document,
	DocumentData,
	DocumentKey,
} from "../../lib/document/types.ts";

export interface DocumentGetOptions {
	readonly consistency: "strong" | "eventual";
}

export interface DocumentListOptions {
	readonly prefix: string[];
	readonly cursor?: string;
	readonly limit?: number;
}

export interface DocumentListResult {
	readonly keys: ReadonlyArray<DocumentKey>;
	readonly cursor?: string;
}

export interface DocumentAtomicsResult {
	ok: boolean;
}

export type DocumentAtomicCheck =
	| { type: "notExists"; readonly key: DocumentKey }
	| { type: "match"; readonly key: DocumentKey; readonly versionstamp: string };

export type DocumentAtomicOperation =
	| { type: "delete"; readonly key: DocumentKey }
	| {
		type: "set";
		readonly key: DocumentKey;
		readonly data: DocumentData;
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

	notExists(key: DocumentKey): DocumentAtomic {
		this.checks.push({ type: "notExists", key });
		return this;
	}

	match(key: DocumentKey, versionstamp: string): DocumentAtomic {
		this.checks.push({ type: "match", key, versionstamp });
		return this;
	}

	set(key: DocumentKey, data: DocumentData): DocumentAtomic {
		this.ops.push({ type: "set", key, data });
		return this;
	}

	delete(key: DocumentKey): DocumentAtomic {
		this.ops.push({ type: "delete", key });
		return this;
	}

	abstract commit(): Promise<DocumentAtomicsResult>;
}

export abstract class DocumentProvider {
	abstract get(
		key: DocumentKey,
		options?: DocumentGetOptions,
	): Promise<Document>;

	abstract getMany(
		keys: Array<DocumentKey>,
		options?: DocumentGetOptions,
	): Promise<Array<Document>>;

	abstract list(options: DocumentListOptions): Promise<DocumentListResult>;

	abstract create(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void>;

	abstract update(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void>;

	abstract patch(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void>;

	abstract delete(key: DocumentKey): Promise<void>;

	abstract deleteMany(keys: Array<DocumentKey>): Promise<void>;

	abstract atomic(): DocumentAtomic;
}
