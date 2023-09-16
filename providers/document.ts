import { Document, DocumentKey } from "../common/document/document.ts";

export interface DocumentListOptions {
	readonly prefix: string[];
	readonly cursor?: string;
	readonly limit?: number;
}

export interface DocumentListResult {
	readonly keys: ReadonlyArray<DocumentKey>;
	readonly cursor?: string;
}

export interface DocumentProvider {
	get<Data = unknown>(
		key: DocumentKey,
	): Promise<Document<Data>>;

	getMany<Data = unknown>(
		keys: Array<DocumentKey>,
	): Promise<Array<Document<Data>>>;

	list(options: DocumentListOptions): Promise<DocumentListResult>;

	create<Data = unknown>(
		key: DocumentKey,
		data: Data,
	): Promise<void>;

	update<Data = unknown>(
		key: DocumentKey,
		data: Data,
	): Promise<void>;

	patch<Data = unknown>(
		key: DocumentKey,
		data: Partial<Data>,
	): Promise<void>;

	delete(key: DocumentKey): Promise<void>;

	deleteMany(keys: Array<DocumentKey>): Promise<void>;
}
