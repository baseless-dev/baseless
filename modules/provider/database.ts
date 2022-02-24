import { CollectionReference, DatabaseScanFilter, DocumentReference } from "https://baseless.dev/x/shared/database.ts";
import type { KVSetOptions } from "./kv.ts";
import { NoopProviderError } from "./mod.ts";

/**
 * Document
 */
export interface IDocument<Metadata, Data> {
	/**
	 * Reference to this document
	 */
	reference: DocumentReference;

	/**
	 * Metadata of the document
	 */
	metadata: Partial<Metadata>;

	/**
	 * Retrieve the underlying document's data
	 */
	data(): Promise<Partial<Metadata & Data>>;
}

/**
 * Alias of KVSetOptions
 */
export type DatabaseSetOptions = KVSetOptions;

/**
 * Database service
 */
export interface IDatabaseProvider {
	/**
	 * Retrieve a single document from the database
	 */
	get<Metadata, Data>(
		reference: DocumentReference,
	): Promise<IDocument<Metadata, Data>>;

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<IDocument<Metadata, Data>[]>;

	/**
	 * Create a document
	 */
	create<Metadata, Data>(
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
		options?: DatabaseSetOptions,
	): Promise<void>;

	/**
	 * Update a document
	 */
	update<Metadata, Data>(
		reference: DocumentReference,
		metadata?: Partial<Metadata>,
		data?: Partial<Data>,
		options?: DatabaseSetOptions,
	): Promise<void>;

	/**
	 * Replace a document
	 */
	replace<Metadata, Data>(
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
		options?: DatabaseSetOptions,
	): Promise<void>;

	/**
	 * Delete a document
	 */
	delete(reference: DocumentReference): Promise<void>;
}

/**
 * Noop Database Provider
 */
export class NoopDatabaseProvider implements IDatabaseProvider {
	/**
	 * Retrieve a single document
	 */
	get<Metadata, Data>(): Promise<IDocument<Metadata, Data>> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(): Promise<IDocument<Metadata, Data>[]> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Create a document
	 */
	create(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Update a document
	 */
	update(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Replace a document
	 */
	replace(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Delete a document
	 */
	delete(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}
}
