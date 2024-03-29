import type {
	Document,
	DocumentData,
	DocumentKey,
} from "../../lib/document/types.ts";
import type {
	DocumentAtomic,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentProvider,
} from "../../providers/document/provider.ts";

export class DocumentService {
	#documentProvider: DocumentProvider;

	constructor(
		documentProvider: DocumentProvider,
	) {
		this.#documentProvider = documentProvider;
	}

	get(
		key: DocumentKey,
		options?: DocumentGetOptions | undefined,
	): Promise<Document> {
		return this.#documentProvider.get(key, options);
	}

	getMany(
		keys: DocumentKey[],
		options?: DocumentGetOptions | undefined,
	): Promise<Document[]> {
		return this.#documentProvider.getMany(keys, options);
	}

	list(options: DocumentListOptions): AsyncIterableIterator<DocumentListEntry> {
		return this.#documentProvider.list(options);
	}

	async create(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		// TODO security rules
		await this.#documentProvider.create(key, data);
		// TODO life cycle
	}

	async update(
		key: DocumentKey,
		data: DocumentData,
	): Promise<void> {
		// TODO security rules
		await this.#documentProvider.update(key, data);
		// TODO life cycle
	}

	async patch(
		key: DocumentKey,
		data: DocumentData,
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
