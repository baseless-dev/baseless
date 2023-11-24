import type { Document, DocumentKey } from "../../common/document/document.ts";
import type { IDocumentService } from "../../common/server/services/document.ts";
import type {
	DocumentAtomic,
	DocumentGetOptions,
	DocumentListOptions,
	DocumentListResult,
	DocumentProvider,
} from "../../providers/document.ts";

export class DocumentService implements IDocumentService {
	#documentProvider: DocumentProvider;

	constructor(
		documentProvider: DocumentProvider,
	) {
		this.#documentProvider = documentProvider;
	}

	get<Data = unknown>(
		key: DocumentKey,
		options?: DocumentGetOptions | undefined,
	): Promise<Document<Data>> {
		return this.#documentProvider.get(key, options);
	}

	getMany<Data = unknown>(
		keys: DocumentKey[],
		options?: DocumentGetOptions | undefined,
	): Promise<Document<Data>[]> {
		return this.#documentProvider.getMany(keys, options);
	}

	list(options: DocumentListOptions): Promise<DocumentListResult> {
		return this.#documentProvider.list(options);
	}

	async create<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void> {
		// TODO security rules
		await this.#documentProvider.create(key, data);
		// TODO life cycle
	}

	async update<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Data>,
	): Promise<void> {
		// TODO security rules
		await this.#documentProvider.update(key, data);
		// TODO life cycle
	}

	async patch<Data = unknown>(
		key: DocumentKey,
		data: Readonly<Partial<Data>>,
	): Promise<void> {
		// TODO security rules
		await this.#documentProvider.patch(key, data);
		// TODO life cycle
	}

	async delete(key: DocumentKey): Promise<void> {
		// TODO security rules
		await this.#documentProvider.delete(key);
		// TODO life cycle
	}

	async deleteMany(keys: DocumentKey[]): Promise<void> {
		// TODO security rules
		await this.#documentProvider.deleteMany(keys);
		// TODO life cycle
	}

	atomic(): DocumentAtomic {
		return this.#documentProvider.atomic();
	}
}
