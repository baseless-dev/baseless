import {
	DocumentAtomic,
	type DocumentAtomicsResult,
	type DocumentGetOptions,
	type DocumentListOptions,
	type DocumentListResult,
} from "../../../providers/document.ts";
import type { Document, DocumentKey } from "../../document/document.ts";

export interface IDocumentService {
	get<Data = unknown>(
		key: DocumentKey,
		options?: DocumentGetOptions,
	): Promise<Document<Data>>;

	getMany<Data = unknown>(
		keys: Array<DocumentKey>,
		options?: DocumentGetOptions,
	): Promise<Array<Document<Data>>>;

	list(options: DocumentListOptions): Promise<DocumentListResult>;

	create<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void>;

	update<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void>;

	patch<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Partial<Data>>,
	): Promise<void>;

	delete(key: DocumentKey): Promise<void>;

	deleteMany(keys: Array<DocumentKey>): Promise<void>;

	atomic(): DocumentAtomic;
}
