import type { Document, DocumentKey } from "../common/document/document.ts";

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
		readonly data: Readonly<unknown>;
	};

export class DocumentAtomic {
	public readonly checks: ReadonlyArray<DocumentAtomicCheck>;
	public readonly ops: ReadonlyArray<DocumentAtomicOperation>;

	constructor(
		checks: Array<DocumentAtomicCheck> = [],
		ops: Array<DocumentAtomicOperation> = [],
	) {
		this.checks = checks;
		this.ops = ops;
	}

	notExists(key: DocumentKey): DocumentAtomic {
		return new DocumentAtomic(
			[...this.checks, { type: "notExists", key }],
			[...this.ops],
		);
	}

	match(key: DocumentKey, versionstamp: string): DocumentAtomic {
		return new DocumentAtomic(
			[...this.checks, { type: "match", key, versionstamp }],
			[...this.ops],
		);
	}

	set<Data = unknown>(key: DocumentKey, data: Readonly<Data>): DocumentAtomic {
		return new DocumentAtomic(
			[...this.checks],
			[...this.ops, { type: "set", key, data }],
		);
	}

	delete(key: DocumentKey): DocumentAtomic {
		return new DocumentAtomic(
			[...this.checks],
			[...this.ops, { type: "delete", key }],
		);
	}
}

export abstract class DocumentProvider {
	abstract get<Data = unknown>(
		key: DocumentKey,
		options?: DocumentGetOptions,
	): Promise<Document<Data>>;

	abstract getMany<Data = unknown>(
		keys: Array<DocumentKey>,
		options?: DocumentGetOptions,
	): Promise<Array<Document<Data>>>;

	abstract list(options: DocumentListOptions): Promise<DocumentListResult>;

	abstract create<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void>;

	abstract update<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void>;

	abstract patch<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Partial<Data>>,
	): Promise<void>;

	abstract delete(key: DocumentKey): Promise<void>;

	abstract deleteMany(keys: Array<DocumentKey>): Promise<void>;

	atomic(): DocumentAtomic {
		return new DocumentAtomic();
	}

	abstract commit(
		atomic: DocumentAtomic,
	): Promise<DocumentAtomicsResult>;
}
