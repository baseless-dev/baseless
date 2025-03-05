import type { Document, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";

// deno-lint-ignore no-empty-interface
export interface Register {}

// deno-fmt-ignore
export type RegisteredFetch = Register extends { requestFetch: infer TFetch }
	? TFetch
	: AnyFetch;

export interface AnyFetch {
	(endpoint: string, input: unknown, signal?: AbortSignal): Promise<unknown>;
}

// deno-fmt-ignore
export type RegisteredDocument = Register extends { documentGet: infer TDocumentGet; documentList: infer TDocumentList; documentGetMany: infer TDocumentGetMany }
	? { get: TDocumentGet; getMany: TDocumentGetMany; list: TDocumentList; atomic: () => RegisteredDocumentAtomic; }
	: AnyDocument;

export interface AnyDocument {
	get: (path: string, options?: DocumentGetOptions, abortSignal?: AbortSignal) => Promise<Document>;
	list: (options: DocumentListOptions, abortSignal?: AbortSignal) => ReadableStream<DocumentListEntry>;
	getMany: (paths: string[], options?: DocumentGetOptions, abortSignal?: AbortSignal) => Promise<Array<Document>>;
	atomic: () => RegisteredDocumentAtomic;
}

// deno-fmt-ignore
export type RegisteredDocumentAtomic = Register extends { documentAtomicCheck: infer TDocumentAtomicCheck; documentAtomicSet: infer TDocumentAtomicSet; documentAtomicDelete: infer TDocumentAtomicDelete }
	? { check: TDocumentAtomicCheck; set: TDocumentAtomicSet; delete: TDocumentAtomicDelete; commit: () => RegisteredDocumentAtomic; }
	: AnyDocumentAtomic;

export interface AnyDocumentAtomic {
	check: (path: string, versionstamp: string | null) => RegisteredDocumentAtomic;
	set: (path: string, value: unknown) => RegisteredDocumentAtomic;
	delete: (path: string) => RegisteredDocumentAtomic;
	commit: () => Promise<void>;
}

// deno-fmt-ignore
export type RegisteredPubSub = Register extends { pubSubPublish: infer TPubSubPublish; pubSubSubscribe: infer TPubSubSubscribe }
	? { publish: TPubSubPublish; subscribe: TPubSubSubscribe; }
	: AnyPubSub;

export interface AnyPubSub {
	publish(path: string, payload: unknown, abortSignal?: AbortSignal): Promise<void>;
	subscribe(path: string, abortSignal?: AbortSignal): ReadableStream<unknown>;
}
