// deno-lint-ignore-file no-explicit-any
import {
	DocumentAtomic,
	DocumentAtomicsResult,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentProvider,
} from "./provider.ts";
import { Document } from "@baseless/core/document";
import { CollectionDefinition, DocumentDefinition, PathMatcher, PickAtPath } from "./types.ts";
import { Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

// TODO call event listeners

export class DocumentService<
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
> extends DocumentProvider {
	#provider: DocumentProvider;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any, any, any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any, any, any, any>>;

	constructor(
		provider: DocumentProvider,
		documentMatcher: PathMatcher<DocumentDefinition<any, any, any, any, any>>,
		collectionMatcher: PathMatcher<CollectionDefinition<any, any, any, any, any>>,
	) {
		super();
		this.#provider = provider;
		this.#documentMatcher = documentMatcher;
		this.#collectionMatcher = collectionMatcher;
	}

	get<
		const TDocumentPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TDocumentPath>,
	>(
		key: TDocumentPath,
		options?: DocumentGetOptions,
	): Promise<Document<Static<TDocumentDefinition["schema"]>>> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		return this.#provider.get(key, options);
	}

	getMany<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		keys: Array<TDocumentPath>,
		options?: DocumentGetOptions,
	): Promise<Array<Document>> {
		if (!keys.every((key) => this.#documentMatcher(key) !== undefined)) {
			throw new UnknownDocumentError();
		}
		return this.#provider.getMany(keys, options);
	}

	async *list<
		const TCollectionPath extends TCollection[number]["matcher"],
		const TCollectionDefinition extends PickAtPath<TCollection, TCollectionPath>,
	>(
		options: DocumentListOptions<TCollectionPath>,
	): AsyncIterableIterator<DocumentListEntry<Static<TCollectionDefinition["schema"]>>> {
		const definition = this.#documentMatcher(options.prefix);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		yield* this.#provider.list(options);
	}

	create<
		const TDocumentPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TDocumentPath>,
	>(
		key: TDocumentPath,
		data: Static<TDocumentDefinition["schema"]>,
	): Promise<void> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		if (!Value.Check(definition.schema, data)) {
			throw new InvalidDocumentError();
		}
		return this.#provider.create(key, data);
	}

	update<
		const TDocumentPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TDocumentPath>,
	>(
		key: TDocumentPath,
		data: Static<TDocumentDefinition["schema"]>,
	): Promise<void> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		if (!Value.Check(definition.schema, data)) {
			throw new InvalidDocumentError();
		}
		return this.#provider.update(key, data);
	}

	delete<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(key: TDocumentPath): Promise<void> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		return this.#provider.delete(key);
	}

	deleteMany<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		keys: Array<TDocumentPath>,
	): Promise<void> {
		if (!keys.every((key) => this.#documentMatcher(key) !== undefined)) {
			throw new UnknownDocumentError();
		}
		return this.#provider.deleteMany(keys);
	}

	atomic(): DocumentServiceAtomic<TDocument, TCollection> {
		return new DocumentServiceAtomic(this.#provider.atomic(), this.#documentMatcher);
	}
}

export class DocumentServiceAtomic<
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
> extends DocumentAtomic {
	#atomic: DocumentAtomic;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any, any, any, any>>;

	constructor(
		atomic: DocumentAtomic,
		documentMatcher: PathMatcher<DocumentDefinition<any, any, any, any, any>>,
	) {
		super();
		this.#atomic = atomic;
		this.#documentMatcher = documentMatcher;
	}

	notExists<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		key: TDocumentPath,
	): DocumentServiceAtomic<TDocument, TCollection> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		this.#atomic.notExists(key as string[]);
		return this;
	}

	match<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		key: TDocumentPath,
		versionstamp: string,
	): DocumentServiceAtomic<TDocument, TCollection> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		this.#atomic.match(key as string[], versionstamp);
		return this;
	}

	set<
		const TDocumentPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TDocumentPath>,
	>(
		key: TDocumentPath,
		data: Static<TDocumentDefinition["schema"]>,
	): DocumentServiceAtomic<TDocument, TCollection> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		if (!Value.Check(definition.schema, data)) {
			throw new InvalidDocumentError();
		}
		this.#atomic.set(key, data);
		return this;
	}

	delete<
		const TDocumentPath extends TDocument[number]["matcher"],
	>(
		key: TDocumentPath,
	): DocumentServiceAtomic<TDocument, TCollection> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		this.#atomic.delete(key as string[]);
		return this;
	}

	commit(): Promise<DocumentAtomicsResult> {
		return this.#atomic.commit();
	}
}

export class UnknownDocumentError extends Error {}
export class UnknownCollectionError extends Error {}
export class InvalidDocumentError extends Error {}
