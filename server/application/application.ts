// deno-lint-ignore-file no-explicit-any
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
	RpcDefinition,
} from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import { Document } from "@baseless/core/document";
import {
	DocumentAtomic,
	DocumentAtomicCommitError,
	DocumentAtomicOperation,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentProvider,
} from "../provider/document.ts";

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
	#rpcMatcher: PathMatcher<RpcDefinition<any, any, any>>;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any>>;
	#documentSavingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>;
	#documentSavedListenersMatcher: PathMatcher<DocumentListener<any, any>>;
	#documentDeletingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>;
	#documentDeletedListenersMatcher: PathMatcher<DocumentListener<any, any>>;

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
		this.#rpcMatcher = createPathMatcher(rpcDefinitions);
		this.#documentMatcher = createPathMatcher([
			...documentDefinitions,
			...collectionDefinitions.map((definition) => ({
				path: [...definition.path, "{docId}"],
				matcher: definition.matcher,
				schema: definition.schema,
				...("security" in definition ? { security: definition.security } : {}),
			})),
		]);
		this.#collectionMatcher = createPathMatcher(collectionDefinitions);
		this.#documentSavingListenersMatcher = createPathMatcher(documentSavingListeners);
		this.#documentSavedListenersMatcher = createPathMatcher(documentSavedListeners);
		this.#documentDeletingListenersMatcher = createPathMatcher(documentDeletingListeners);
		this.#documentDeletedListenersMatcher = createPathMatcher(documentDeletedListeners);
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
		const firstResult = this.#rpcMatcher(key).next();
		if (firstResult.done) {
			throw new UnknownRpcError();
		}
		const definition = firstResult.value;
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
		} else {
			// TODO block by default, bypass when executed by the server?
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
		const firstResult = this.#documentMatcher(key).next();
		if (firstResult.done) {
			throw new UnknownRpcError();
		}
		const definition = firstResult.value;
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
			const firstResult = this.#documentMatcher(document.key).next();
			if (firstResult.done) {
				throw new UnknownRpcError();
			}
			const definition = firstResult.value;
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
		const firstResult = this.#collectionMatcher(options.prefix).next();
		if (firstResult.done) {
			throw new UnknownRpcError();
		}
		const definition = firstResult.value;
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
			this.#documentMatcher,
			this.#documentSavingListenersMatcher,
			this.#documentSavedListenersMatcher,
			this.#documentDeletingListenersMatcher,
			this.#documentDeletedListenersMatcher,
		);
	}
}

export class ApplicationDocumentAtomic extends DocumentAtomic {
	#context: Context<any, any, any>;
	#provider: DocumentProvider;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any>>;
	#documentSavingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>;
	#documentSavedListenersMatcher: PathMatcher<DocumentListener<any, any>>;
	#documentDeletingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>;
	#documentDeletedListenersMatcher: PathMatcher<DocumentListener<any, any>>;

	constructor(
		context: Context<any, any, any>,
		provider: DocumentProvider,
		documentMatcher: PathMatcher<DocumentDefinition<any, any>>,
		documentSavingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>,
		documentSavedListenersMatcher: PathMatcher<DocumentListener<any, any>>,
		documentDeletingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>,
		documentDeletedListenersMatcher: PathMatcher<DocumentListener<any, any>>,
	) {
		super();
		this.#context = context;
		this.#provider = provider;
		this.#documentMatcher = documentMatcher;
		this.#documentSavingListenersMatcher = documentSavingListenersMatcher;
		this.#documentSavedListenersMatcher = documentSavedListenersMatcher;
		this.#documentDeletingListenersMatcher = documentDeletingListenersMatcher;
		this.#documentDeletedListenersMatcher = documentDeletedListenersMatcher;
	}

	async commit(): Promise<void> {
		const atomic = this.#provider.atomic();
		for (const check of this.checks) {
			const definition = this.#documentMatcher(check.key);
			if (!definition) {
				throw new DocumentAtomicCommitError();
			}
			atomic.check(check.key, check.versionstamp);
		}
		const postOps: Array<{
			op: DocumentAtomicOperation;
			document: Document<unknown>;
			params: PathAsType<any>;
		}> = [];
		for (const op of this.ops) {
			const firstResult = this.#documentMatcher(op.key).next();
			if (firstResult.done) {
				throw new UnknownRpcError();
			}
			const definition = firstResult.value;
			const params = PathAsType(definition.path, op.key);
			if (op.type === "delete") {
				const document = await this.#provider.get(op.key).catch(() => undefined);
				if (document) {
					const security = "security" in definition
						? await definition.security({
							context: this.#context,
							params,
							document,
						})
						: null;
					if (security !== null && security !== "delete") {
						throw new DocumentAtomicCommitError();
					}
					for (const event of this.#documentDeletingListenersMatcher(op.key)) {
						const params = PathAsType(event.path, op.key);
						await event.handler({ context: this.#context, params, document, atomic });
					}
					atomic.delete(op.key);
					postOps.push({ document, params, op });
				}
			} else {
				const document = { key: op.key, data: op.data, versionstamp: "" };
				const security = "security" in definition
					? await definition.security({
						context: this.#context,
						params,
						document,
					})
					: null;
				if (security !== null && security !== "set") {
					throw new DocumentAtomicCommitError();
				}
				for (const event of this.#documentSavingListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context: this.#context, params, document, atomic });
				}
				atomic.set(op.key, op.data);
				postOps.push({ document, params, op });
			}
		}
		await atomic.commit();
		for (const { op, document, params } of postOps) {
			if (op.type === "delete") {
				for (const event of this.#documentDeletedListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context: this.#context, params, document })
						.catch((_) => {});
				}
			} else {
				for (const event of this.#documentSavedListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context: this.#context, params, document })
						.catch((_) => {});
				}
			}
		}
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
