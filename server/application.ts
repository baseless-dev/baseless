import { createPathMatcher, PathAsType, PathMatcher } from "@baseless/core/path";
import type {
	CollectionDefinition,
	Context,
	Decorator,
	DocumentAtomicListener,
	DocumentDefinition,
	DocumentListener,
	EventDefinition,
	EventListener,
	IdentityListener,
	RpcDefinition,
} from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import {
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentProvider,
} from "./provider.ts";
import { Document } from "@baseless/core/document";
import { id } from "../core/id.ts";

export class Application {
	#decorator: ReadonlyArray<Decorator<any, any, any, any>>;
	#rpc: ReadonlyArray<RpcDefinition<any, any, any, any, any, any>>;
	#event: ReadonlyArray<EventDefinition<any, any, any, any, any>>;
	#document: ReadonlyArray<DocumentDefinition<any, any, any, any, any>>;
	#collection: ReadonlyArray<CollectionDefinition<any, any, any, any, any>>;
	#eventListeners: ReadonlyArray<EventListener<any, any, any, any, any>>;
	#documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>;
	#documentSavedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>;
	#documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>;
	#documentDeletedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>;
	#identityCreatedListeners: ReadonlyArray<IdentityListener<any, any, any>>;
	#identityUpdatedListeners: ReadonlyArray<IdentityListener<any, any, any>>;
	#identityDeletedListeners: ReadonlyArray<IdentityListener<any, any, any>>;
	#rpcMatcher: PathMatcher<RpcDefinition<any, any, any, any, any, any>>;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any, any, any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any, any, any, any>>;

	constructor(
		decorator: ReadonlyArray<Decorator<any, any, any, any>>,
		rpc: ReadonlyArray<RpcDefinition<any, any, any, any, any, any>>,
		event: ReadonlyArray<EventDefinition<any, any, any, any, any>>,
		document: ReadonlyArray<DocumentDefinition<any, any, any, any, any>>,
		collection: ReadonlyArray<CollectionDefinition<any, any, any, any, any>>,
		eventListeners: ReadonlyArray<EventListener<any, any, any, any, any>>,
		documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>,
		documentSavedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>,
		documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>,
		documentDeletedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>,
		identityCreatedListeners: ReadonlyArray<IdentityListener<any, any, any>>,
		identityUpdatedListeners: ReadonlyArray<IdentityListener<any, any, any>>,
		identityDeletedListeners: ReadonlyArray<IdentityListener<any, any, any>>,
	) {
		this.#decorator = decorator;
		this.#rpc = rpc;
		this.#event = event;
		this.#document = document;
		this.#collection = collection;
		this.#eventListeners = eventListeners;
		this.#documentSavingListeners = documentSavingListeners;
		this.#documentSavedListeners = documentSavedListeners;
		this.#documentDeletingListeners = documentDeletingListeners;
		this.#documentDeletedListeners = documentDeletedListeners;
		this.#identityCreatedListeners = identityCreatedListeners;
		this.#identityUpdatedListeners = identityUpdatedListeners;
		this.#identityDeletedListeners = identityDeletedListeners;
		this.#rpcMatcher = createPathMatcher(rpc);
		this.#documentMatcher = createPathMatcher(document);
		this.#collectionMatcher = createPathMatcher(collection);
	}

	async invokeRpc({ context, key, input }: {
		context: Context<any, any, any>;
		key: string[];
		input: unknown;
	}): Promise<unknown> {
		const definition = this.#rpcMatcher(key);
		if (!definition) {
			throw new UnknownRpcError();
		}
		if (!Value.Check(definition.input, input)) {
			throw new InvalidInputError();
		}
		if ("security" in definition) {
			const params = PathAsType(definition.path, key);
			const result = await definition.security({
				context,
				params,
				input,
			});
			if (result !== "allow") {
				throw new ForbiddenError();
			}
		}
		const output = await definition.handler({
			context,
			params,
			input,
		});
		if (!Value.Check(definition.output, output)) {
			throw new InvalidOutputError();
		}
		return output;
	}

	async getDocument({ context, provider, key, options }: {
		context: Context<any, any, any>;
		provider: DocumentProvider;
		key: string[];
		options?: DocumentGetOptions;
	}): Promise<Document> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		const document = await provider.get(key, options);
		if ("security" in definition) {
			const params = PathAsType(definition.path, key);
			const result = await definition.security({
				context,
				params,
				document,
			});
			if (result !== "read") {
				throw new ForbiddenError();
			}
		}
		return document;
	}

	async getManyDocument({ context, provider, keys, options }: {
		context: Context<any, any, any>;
		provider: DocumentProvider;
		keys: Array<string[]>;
		options?: DocumentGetOptions;
	}): Promise<Array<Document>> {
		const documents = await provider.getMany(keys, options);
		for (const document of documents) {
			const definition = this.#documentMatcher(document.key);
			if (!definition) {
				throw new UnknownDocumentError();
			}
			if ("security" in definition) {
				const params = PathAsType(definition.path, document.key);
				const result = await definition.security({
					context,
					params,
					document,
				});
				if (result !== "read") {
					throw new ForbiddenError();
				}
			}
		}
		return documents;
	}

	async *listCollection({ context, provider, options }: {
		context: Context<any, any, any>;
		provider: DocumentProvider;
		options: DocumentListOptions;
	}): AsyncIterableIterator<DocumentListEntry> {
		const definition = this.#collectionMatcher(options.prefix);
		if (!definition) {
			throw new UnknownCollectionError();
		}
		if ("security" in definition) {
			const params = PathAsType(definition.path, options.prefix);
			const result = await definition.security({
				context,
				params,
				key: options.prefix,
			});
			if (result !== "list") {
				throw new ForbiddenError();
			}
		}
		yield* provider.list(options);
	}

	async createDocument({ context, provider, key, data }: {
		context: Context<any, any, any>;
		provider: DocumentProvider;
		key: string[];
		data: unknown;
	}): Promise<void> {
		const definition = this.#documentMatcher(key);
		if (!definition) {
			throw new UnknownDocumentError();
		}
		if ("security" in definition) {
			const params = PathAsType(definition.path, key);
			const result = await definition.security({
				context,
				params,
				document: { key, data, versionstamp: "" },
			});
			if (result !== "create") {
				throw new ForbiddenError();
			}
		}
		// TODO event pre
		await provider.create(key, data);
		// TODO event post
	}
}

export class UnknownRpcError extends Error {}
export class UnknownDocumentError extends Error {}
export class UnknownCollectionError extends Error {}
export class InvalidInputError extends Error {}
export class InvalidOutputError extends Error {}
export class InvalidPayloadError extends Error {}
export class InvalidSchemaError extends Error {}
export class ForbiddenError extends Error {}
