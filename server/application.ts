// deno-lint-ignore-file no-explicit-any
import { createPathMatcher, PathAsType, PathMatcher } from "@baseless/core/path";
import {
	type CollectionDefinition,
	type Context,
	type Decorator,
	DocumentAtomicDeleteListener,
	DocumentAtomicSetListener,
	type DocumentDefinition,
	DocumentDeleteListener,
	DocumentSetListener,
	type EventDefinition,
	type EventListener,
	hasPermission,
	Permission,
	type RpcDefinition,
} from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import { Document } from "@baseless/core/document";
import {
	DocumentAtomicCheck,
	DocumentAtomicOperation,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentProvider,
} from "./document_provider.ts";

export class Application {
	#decorators: ReadonlyArray<Decorator<any>>;
	#rpcDefinitions: ReadonlyArray<RpcDefinition<any, any, any>>;
	#eventDefinitions: ReadonlyArray<EventDefinition<any, any>>;
	#documentDefinitions: ReadonlyArray<DocumentDefinition<any, any>>;
	#collectionDefinitions: ReadonlyArray<CollectionDefinition<any, any>>;
	#eventListeners: ReadonlyArray<EventListener<any, any>>;
	#documentSavingListeners: ReadonlyArray<DocumentAtomicSetListener<any, any>>;
	#documentSavedListeners: ReadonlyArray<DocumentSetListener<any, any>>;
	#documentDeletingListeners: ReadonlyArray<DocumentAtomicDeleteListener<any, any>>;
	#documentDeletedListeners: ReadonlyArray<DocumentDeleteListener<any, any>>;
	#rpcMatcher: PathMatcher<RpcDefinition<any, any, any>>;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any>>;
	#documentSavingListenersMatcher: PathMatcher<DocumentAtomicSetListener<any, any>>;
	#documentSavedListenersMatcher: PathMatcher<DocumentSetListener<any, any>>;
	#documentDeletingListenersMatcher: PathMatcher<DocumentAtomicDeleteListener<any, any>>;
	#documentDeletedListenersMatcher: PathMatcher<DocumentDeleteListener<any, any>>;

	constructor(
		decorators: ReadonlyArray<Decorator<any>>,
		rpcDefinitions: ReadonlyArray<RpcDefinition<any, any, any>>,
		eventDefinitions: ReadonlyArray<EventDefinition<any, any>>,
		documentDefinitions: ReadonlyArray<DocumentDefinition<any, any>>,
		collectionDefinitions: ReadonlyArray<CollectionDefinition<any, any>>,
		eventListeners: ReadonlyArray<EventListener<any, any>>,
		documentSavingListeners: ReadonlyArray<DocumentAtomicSetListener<any, any>>,
		documentSavedListeners: ReadonlyArray<DocumentSetListener<any, any>>,
		documentDeletingListeners: ReadonlyArray<DocumentAtomicDeleteListener<any, any>>,
		documentDeletedListeners: ReadonlyArray<DocumentDeleteListener<any, any>>,
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

	async invokeRpc({ bypassSecurity, context, input, rpc }: {
		bypassSecurity?: boolean;
		context: Context<any, any, any>;
		input: unknown;
		rpc: string[];
	}): Promise<unknown> {
		const firstResult = this.#rpcMatcher(rpc).next();
		if (firstResult.done) {
			throw new UnknownRpcError();
		}
		const definition = firstResult.value;
		if (!Value.Check(definition.input, input)) {
			throw new InvalidInputError();
		}
		const definitionOptions = {
			context,
			params: PathAsType(definition.path, rpc),
			input,
		};
		if (
			bypassSecurity !== true &&
			(
				!("security" in definition) ||
				!hasPermission(await definition.security(definitionOptions), Permission.Execute)
			)
		) {
			throw new ForbiddenError();
		}
		const output = await definition.handler(definitionOptions);
		if (!Value.Check(definition.output, output)) {
			throw new InvalidOutputError();
		}
		return output;
	}

	async getDocument({ bypassSecurity, context, options, path, provider }: {
		bypassSecurity?: boolean;
		context: Context<any, any, any>;
		options?: DocumentGetOptions;
		path: string[];
		provider: DocumentProvider;
	}): Promise<Document> {
		const firstResult = this.#documentMatcher(path).next();
		if (firstResult.done) {
			throw new UnknownDocumentError();
		}
		const definition = firstResult.value;
		if (
			bypassSecurity !== true &&
			(
				!("security" in definition) ||
				!hasPermission(
					await definition.security({
						context,
						params: PathAsType(definition.path, path),
					}),
					Permission.Get,
				)
			)
		) {
			throw new ForbiddenError();
		}
		return provider.get(path, options);
	}

	async getManyDocument({ bypassSecurity, context, options, paths, provider }: {
		bypassSecurity?: boolean;
		context: Context<any, any, any>;
		options?: DocumentGetOptions;
		paths: Array<string[]>;
		provider: DocumentProvider;
	}): Promise<Array<Document>> {
		for (const path of paths) {
			const firstResult = this.#documentMatcher(path).next();
			if (firstResult.done) {
				throw new UnknownDocumentError();
			}
			const definition = firstResult.value;
			const definitionOptions = {
				context,
				params: PathAsType(definition.path, path),
			};
			if (
				bypassSecurity !== true &&
				(
					!("security" in definition) ||
					!hasPermission(await definition.security(definitionOptions), Permission.Get)
				)
			) {
				throw new ForbiddenError();
			}
		}
		return provider.getMany(paths, options);
	}

	async *listDocument({ bypassSecurity, context, cursor, limit, prefix, provider }: {
		bypassSecurity?: boolean;
		context: Context<any, any, any>;
		cursor?: string;
		limit?: number;
		prefix: string[];
		provider: DocumentProvider;
	}): AsyncIterableIterator<DocumentListEntry> {
		const firstResult = this.#collectionMatcher(prefix).next();
		if (firstResult.done) {
			throw new UnknownCollectionError();
		}
		const definition = firstResult.value;
		const options = {
			context,
			params: PathAsType(definition.path, prefix),
			key: prefix,
		};
		if (
			bypassSecurity !== true &&
			(
				!("security" in definition) ||
				!hasPermission(await definition.security(options), Permission.List)
			)
		) {
			throw new ForbiddenError();
		}
		yield* provider.list({ prefix, cursor, limit });
	}

	async commitDocumentAtomic({ bypassSecurity, checks, context, operations, provider }: {
		bypassSecurity?: boolean;
		checks: DocumentAtomicCheck[];
		context: Context<any, any, any>;
		operations: DocumentAtomicOperation[];
		provider: DocumentProvider;
	}): Promise<void> {
		if (bypassSecurity !== true) {
			await this.getManyDocument({
				paths: checks.map((c) => c.key),
				context,
				provider,
			});
		}
		const atomic = provider.atomic();
		for (const check of checks) {
			atomic.check(check.key, check.versionstamp);
		}
		for (const op of operations) {
			if (op.type === "delete") {
				atomic.delete(op.key);
			} else {
				atomic.set(op.key, op.data);
			}
		}
		for (const op of atomic.operations) {
			const firstResult = this.#documentMatcher(op.key).next();
			if (firstResult.done) {
				throw new UnknownDocumentError();
			}
			const definition = firstResult.value;
			const options = {
				context,
				params: PathAsType(definition.path, op.key),
			};
			if (
				bypassSecurity !== true &&
				(
					!("security" in definition) ||
					!hasPermission(
						await definition.security(options),
						op.type === "delete" ? Permission.Delete : Permission.Set,
					)
				)
			) {
				throw new ForbiddenError();
			}
			if (op.type === "delete") {
				for (const event of this.#documentDeletingListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params, atomic });
				}
			} else {
				const document = { key: op.key, data: op.data, versionstamp: "" };
				for (const event of this.#documentSavingListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params, document, atomic });
				}
			}
		}
		await atomic.commit();
		for (const op of atomic.operations) {
			if (op.type === "delete") {
				for (const event of this.#documentDeletedListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params }).catch((_) => {});
				}
			} else {
				const document = { key: op.key, data: op.data, versionstamp: "" };
				for (const event of this.#documentSavedListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params, document }).catch((_) => {});
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
