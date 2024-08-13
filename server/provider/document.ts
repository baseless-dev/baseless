import { Static } from "@sinclair/typebox";
import { Document } from "@baseless/core/document";
import { CollectionDefinition, DocumentDefinition, PickAtPath } from "../application/types.ts";

export interface DocumentGetOptions {
	readonly consistency: "strong" | "eventual";
}

export interface DocumentListOptions<TPrefix = string[]> {
	readonly prefix: TPrefix;
	readonly cursor?: string;
	readonly limit?: number;
}

export type DocumentListEntry<TData = unknown> = {
	cursor: string;
	document: Document<TData>;
};

export interface DocumentAtomicsResult {
	ok: boolean;
}

export type DocumentAtomicCheck = {
	type: "check";
	readonly key: string[];
	readonly versionstamp: string | null;
};

export type DocumentAtomicOperation =
	| { type: "delete"; readonly key: string[] }
	| {
		type: "set";
		readonly key: string[];
		readonly data: unknown;
	};

export abstract class DocumentAtomic {
	protected readonly checks: Array<DocumentAtomicCheck> = [];
	protected readonly ops: Array<DocumentAtomicOperation> = [];

	check(key: string[], versionstamp: string | null): DocumentAtomic {
		this.checks.push({ type: "check", key, versionstamp });
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

	abstract atomic(): DocumentAtomic;
}

export class DocumentNotFoundError extends Error {
	constructor(public key: string[], public innerError?: Error) {
		super();
	}
}
export class DocumentCreateError extends Error {
	constructor(public key: string[], public innerError?: Error) {
		super();
	}
}
export class DocumentUpdateError extends Error {
	constructor(public key: string[], public innerError?: Error) {
		super();
	}
}
export class DocumentDeleteError extends Error {
	constructor(public key: string[], public innerError?: Error) {
		super();
	}
}
export class DocumentAtomicError extends Error {
	constructor(public innerError?: Error) {
		super();
	}
}

export interface IDocumentProvider<
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
> {
	get<
		const TDocumentPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TDocumentPath>,
	>(
		key: TDocumentPath,
		options?: DocumentGetOptions,
	): Promise<Document<Static<TDocumentDefinition["schema"]>>>;

	getMany<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		keys: Array<TDocumentPath>,
		options?: DocumentGetOptions,
	): Promise<Array<Document>>;

	list<
		const TCollectionPath extends TCollection[number]["matcher"],
		const TCollectionDefinition extends PickAtPath<TCollection, TCollectionPath>,
	>(
		options: DocumentListOptions<TCollectionPath>,
	): AsyncIterableIterator<DocumentListEntry<Static<TCollectionDefinition["schema"]>>>;

	atomic(): IDocumentAtomic<TDocument, TCollection>;
}

export interface IDocumentAtomic<
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
> {
	check<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		key: TDocumentPath,
		versionstamp: string | null,
	): IDocumentAtomic<TDocument, TCollection>;

	set<
		const TDocumentPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TDocumentPath>,
	>(
		key: TDocumentPath,
		data: Static<TDocumentDefinition["schema"]>,
	): IDocumentAtomic<TDocument, TCollection>;

	delete<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		key: TDocumentPath,
	): IDocumentAtomic<TDocument, TCollection>;

	commit(): Promise<DocumentAtomicsResult>;
}
