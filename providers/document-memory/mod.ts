import { Document, DocumentKey } from "../../common/document/document.ts";
import { createLogger } from "../../common/system/logger.ts";
import {
	DocumentListOptions,
	DocumentListResult,
	DocumentProvider,
} from "../document.ts";

export class MemoryDocumentProvider implements DocumentProvider {
	#logger = createLogger("document-memory");
	#storage = new Map<DocumentKey, Document>();

	get<Data = unknown>(key: DocumentKey): Promise<Document<Data>> {
		throw new Error("Method not implemented.");
	}

	getMany<Data = unknown>(keys: DocumentKey[]): Promise<Document<Data>[]> {
		throw new Error("Method not implemented.");
	}

	list(options: DocumentListOptions): Promise<DocumentListResult> {
		throw new Error("Method not implemented.");
	}

	create<Data = unknown>(key: DocumentKey, data: Data): Promise<void> {
		throw new Error("Method not implemented.");
	}

	update<Data = unknown>(key: DocumentKey, data: Data): Promise<void> {
		throw new Error("Method not implemented.");
	}

	patch<Data = unknown>(key: DocumentKey, data: Partial<Data>): Promise<void> {
		throw new Error("Method not implemented.");
	}

	delete(key: DocumentKey): Promise<void> {
		throw new Error("Method not implemented.");
	}

	deleteMany(keys: DocumentKey[]): Promise<void> {
		throw new Error("Method not implemented.");
	}
}
