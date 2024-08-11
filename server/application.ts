// deno-lint-ignore-file no-explicit-any
import { createPathMatcher, PathAsType, PathMatcher } from "@baseless/core/path";
import type {
	CollectionDefinition,
	Context,
	Decorator,
	DocumentAtomicListener,
	DocumentDefinition,
	DocumentDefinitionWithSecurity,
	DocumentListener,
	EventDefinition,
	EventListener,
	IdentityListener,
	RpcDefinition,
} from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import {
	DocumentAtomicsResult,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentProvider,
} from "./provider.ts";
import { Document } from "@baseless/core/document";
import { DocumentAtomic } from "./provider.ts";

export class Application {
	#decorators: ReadonlyArray<Decorator<any>>;
	#rpcDefinitions: ReadonlyArray<RpcDefinition<any, any, any>>;
	#eventDefinitions: ReadonlyArray<EventDefinition<any, any>>;
	#documentDefinitions: ReadonlyArray<DocumentDefinition<any, any>>;
	#collectionDefinitions: ReadonlyArray<CollectionDefinition<any, any>>;
	#eventListeners: ReadonlyArray<EventListener<any, any>>;
	#documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>;
	#documentSavedListeners: ReadonlyArray<DocumentListener<any, any>>;
	#documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>;
	#documentDeletedListeners: ReadonlyArray<DocumentListener<any, any>>;
	#identityCreatedListeners: ReadonlyArray<IdentityListener>;
	#identityUpdatedListeners: ReadonlyArray<IdentityListener>;
	#identityDeletedListeners: ReadonlyArray<IdentityListener>;
	#rpcMatcher: PathMatcher<RpcDefinition<any, any, any>>;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any>>;

	constructor(
		decorators: ReadonlyArray<Decorator<any>>,
		rpcDefinitions: ReadonlyArray<RpcDefinition<any, any, any>>,
		eventDefinitions: ReadonlyArray<EventDefinition<any, any>>,
		documentDefinitions: ReadonlyArray<DocumentDefinition<any, any>>,
		collectionDefinitions: ReadonlyArray<CollectionDefinition<any, any>>,
		eventListeners: ReadonlyArray<EventListener<any, any>>,
		documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>,
		documentSavedListeners: ReadonlyArray<DocumentListener<any, any>>,
		documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>,
		documentDeletedListeners: ReadonlyArray<DocumentListener<any, any>>,
		identityCreatedListeners: ReadonlyArray<IdentityListener>,
		identityUpdatedListeners: ReadonlyArray<IdentityListener>,
		identityDeletedListeners: ReadonlyArray<IdentityListener>,
	) {
		this.#decorators = decorators;
		this.#rpcDefinitions = rpcDefinitions;
		this.#eventDefinitions = eventDefinitions;
		this.#documentDefinitions = documentDefinitions;
		this.#collectionDefinitions = collectionDefinitions;
		this.#eventListeners = eventListeners;
		this.#documentSavingListeners = documentSavingListeners;
		this.#documentSavedListeners = documentSavedListeners;
		this.#documentDeletingListeners = documentDeletingListeners;
		this.#documentDeletedListeners = documentDeletedListeners;
		this.#identityCreatedListeners = identityCreatedListeners;
		this.#identityUpdatedListeners = identityUpdatedListeners;
		this.#identityDeletedListeners = identityDeletedListeners;
		this.#rpcMatcher = createPathMatcher(rpcDefinitions);
		this.#documentMatcher = createPathMatcher(documentDefinitions);
		this.#collectionMatcher = createPathMatcher(collectionDefinitions);
	}

	async decorate(context: Context<any, any, any>): Promise<void> {
		for (const decorator of this.#decorators) {
			const result = await decorator(context);
			Object.assign(context, result);
		}
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
		const params = PathAsType(definition.path, key);
		if ("security" in definition) {
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
			if (result !== "get") {
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
				if (result !== "get") {
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

	atomicDocument({ context, provider }: {
		context: Context<any, any, any>;
		provider: DocumentProvider;
	}): ApplicationDocumentAtomic {
		return new ApplicationDocumentAtomic(
			context,
			provider,
			this.#documentDefinitions,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
			this.#documentMatcher,
		);
	}
}

export class ApplicationDocumentAtomic extends DocumentAtomic {
	#context: Context<any, any, any>;
	#provider: DocumentProvider;
	#documentDefinitions: ReadonlyArray<DocumentDefinition<any, any>>;
	#documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>;
	#documentSavedListeners: ReadonlyArray<DocumentListener<any, any>>;
	#documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>;
	#documentDeletedListeners: ReadonlyArray<DocumentListener<any, any>>;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any>>;

	constructor(
		context: Context<any, any, any>,
		provider: DocumentProvider,
		documentDefinitions: ReadonlyArray<DocumentDefinition<any, any>>,
		documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>,
		documentSavedListeners: ReadonlyArray<DocumentListener<any, any>>,
		documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any>>,
		documentDeletedListeners: ReadonlyArray<DocumentListener<any, any>>,
		documentMatcher: PathMatcher<DocumentDefinition<any, any>>,
	) {
		super();
		this.#context = context;
		this.#provider = provider;
		this.#documentDefinitions = documentDefinitions;
		this.#documentSavingListeners = documentSavingListeners;
		this.#documentSavedListeners = documentSavedListeners;
		this.#documentDeletingListeners = documentDeletingListeners;
		this.#documentDeletedListeners = documentDeletedListeners;
		this.#documentMatcher = documentMatcher;
	}

	async commit(): Promise<DocumentAtomicsResult> {
		const atomic = this.#provider.atomic();
		for (const check of this.checks) {
			const definition = this.#documentMatcher(check.key);
			if (!definition) {
				throw new UnknownDocumentError();
			}
			atomic.check(check.key, check.versionstamp);
		}
		for (const op of this.ops) {
			const definition = this.#documentMatcher(op.key);
			if (!definition) {
				throw new UnknownDocumentError();
			}
			const document = await this.#provider.get(op.key).catch(() => null);
			let security: Awaited<
				ReturnType<DocumentDefinitionWithSecurity<any, any>["security"]>
			>;
			if ("security" in definition) {
				const params = PathAsType(definition.path, op.key);
				security = await definition.security({
					context: this.#context,
					params,
					document,
				});
			}
			if (op.type === "delete") {
				if (security !== "delete") {
					throw new ForbiddenError();
				}
				// TODO delete event atomic
				atomic.delete(op.key);
			} else {
				if (security !== "set") {
					throw new ForbiddenError();
				}
				// TODO set event atomic
				atomic.set(op.key, op.data);
			}
		}
		const result = await atomic.commit();
		if (result.ok) {
			for (const op of this.ops) {
				if (op.type === "delete") {
					// TODO event post
				} else {
					// TODO event post
				}
			}
		}
		return result;
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
