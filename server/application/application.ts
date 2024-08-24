// deno-lint-ignore-file no-explicit-any
import { createPathMatcher, isPathMatching, PathAsType, PathMatcher } from "@baseless/core/path";
import {
	type CollectionDefinition,
	type Context,
	type Decorator,
	type DocumentAtomicListener,
	type DocumentDefinition,
	type DocumentListener,
	type EventDefinition,
	type EventListener,
	hasPermission,
	Permission,
	type RpcDefinition,
} from "./types.ts";
import { Value } from "@sinclair/typebox/value";
import { Document } from "@baseless/core/document";
import {
	DocumentAtomic,
	DocumentAtomicCheck,
	DocumentAtomicOperation,
	DocumentListEntry,
	DocumentProvider,
} from "../provider/document.ts";
import { CommandDocumentAtomicOp } from "../../core/command.ts";

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

	async invokeRpc({ context, input, rpc }: {
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
		const options = {
			context,
			params: PathAsType(definition.path, rpc),
			input,
		};
		if ("security" in definition) {
			if (!hasPermission(await definition.security(options), Permission.Execute)) {
				throw new ForbiddenError();
			}
		} else {
			throw new ForbiddenError();
		}
		const output = await definition.handler(options);
		if (!Value.Check(definition.output, output)) {
			throw new InvalidOutputError();
		}
		return output;
	}

	async getDocument({ context, path, provider }: {
		context: Context<any, any, any>;
		path: string[];
		provider: DocumentProvider;
	}): Promise<Document> {
		const firstResult = this.#documentMatcher(path).next();
		if (firstResult.done) {
			throw new UnknownDocumentError();
		}
		const definition = firstResult.value;
		const document = await provider.get(path, { consistency: "eventual" });
		const options = {
			context,
			params: PathAsType(definition.path, path),
			document,
		};
		if ("security" in definition) {
			if (!hasPermission(await definition.security(options), Permission.Get)) {
				throw new ForbiddenError();
			}
		} else {
			throw new ForbiddenError();
		}
		return document;
	}

	async getManyDocument({ context, paths, provider }: {
		context: Context<any, any, any>;
		paths: Array<string[]>;
		provider: DocumentProvider;
	}): Promise<Array<Document>> {
		const documents = await provider.getMany(paths, {
			consistency: "eventual",
		});
		for (const path of paths) {
			const document = documents.find((doc) => isPathMatching(path, doc.key));
			if (!document) {
				throw new UnknownDocumentError();
			}
			const firstResult = this.#documentMatcher(document.key).next();
			if (firstResult.done) {
				throw new UnknownDocumentError();
			}
			const definition = firstResult.value;
			const options = {
				context,
				params: PathAsType(definition.path, document.key),
				document,
			};
			if ("security" in definition) {
				if (!hasPermission(await definition.security(options), Permission.Get)) {
					throw new ForbiddenError();
				}
			} else {
				throw new ForbiddenError();
			}
		}
		return documents;
	}

	async listDocument({ context, cursor, limit, prefix, provider }: {
		context: Context<any, any, any>;
		cursor?: string;
		limit?: number;
		prefix: string[];
		provider: DocumentProvider;
	}): Promise<AsyncIterableIterator<DocumentListEntry>> {
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
		if ("security" in definition) {
			if (!hasPermission(await definition.security(options), Permission.List)) {
				throw new ForbiddenError();
			}
		} else {
			throw new ForbiddenError();
		}
		return provider.list({
			prefix,
			cursor,
			limit,
		});
	}

	async commitDocumentAtomic({ checks, context, ops, provider }: {
		checks: DocumentAtomicCheck[];
		context: Context<any, any, any>;
		ops: DocumentAtomicOperation[];
		provider: DocumentProvider;
	}): Promise<void> {
		await this.getManyDocument({
			paths: checks.map((c) => c.key),
			context,
			provider,
		});
		const atomic = provider.atomic();
		for (const check of checks) {
			atomic.check(check.key, check.versionstamp);
		}
		const opsCache: Array<{
			document?: Document<unknown>;
			op: CommandDocumentAtomicOp;
		}> = [];
		for (const op of ops) {
			const document = op.type === "set"
				? { key: op.key, data: op.data, versionstamp: "" }
				: undefined;
			const firstResult = this.#documentMatcher(op.key).next();
			if (firstResult.done) {
				throw new UnknownDocumentError();
			}
			const definition = firstResult.value;
			const options = {
				context,
				params: PathAsType(definition.path, op.key),
				document,
			};
			if ("security" in definition) {
				const result = await definition.security(options);
				if (op.type === "delete") {
					if (!hasPermission(result, Permission.Delete)) {
						throw new ForbiddenError();
					}
				} else {
					if (!hasPermission(result, Permission.Set)) {
						throw new ForbiddenError();
					}
				}
				opsCache.push({ document, op });
			} else {
				throw new ForbiddenError();
			}
			if (op.type === "delete") {
				atomic.delete(op.key);
				for (const event of this.#documentDeletingListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params, document, atomic });
				}
			} else {
				atomic.set(op.key, op.data);
				for (const event of this.#documentSavingListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params, document, atomic });
				}
			}
		}
		await atomic.commit();
		for (const { op, document } of opsCache) {
			if (op.type === "delete") {
				for (const event of this.#documentDeletedListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params, document })
						.catch((_) => {});
				}
			} else {
				for (const event of this.#documentSavedListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({ context, params, document })
						.catch((_) => {});
				}
			}
		}
	}

	getDocumentAtomic({ context, provider }: {
		context: Context<any, any, any>;
		provider: DocumentProvider;
	}): DocumentAtomic {
		return new ApplicationDocumentAtomicFacade(
			this.#documentMatcher,
			this.#collectionMatcher,
			this.#documentSavingListenersMatcher,
			this.#documentSavedListenersMatcher,
			this.#documentDeletingListenersMatcher,
			this.#documentDeletedListenersMatcher,
			context,
			provider,
		);
	}
}

export class ApplicationDocumentAtomicFacade extends DocumentAtomic {
	#documentMatcher: PathMatcher<DocumentDefinition<any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any>>;
	#documentSavingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>;
	#documentSavedListenersMatcher: PathMatcher<DocumentListener<any, any>>;
	#documentDeletingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>;
	#documentDeletedListenersMatcher: PathMatcher<DocumentListener<any, any>>;
	#context: Context<any, any, any>;
	#provider: DocumentProvider;

	constructor(
		documentMatcher: PathMatcher<DocumentDefinition<any, any>>,
		collectionMatcher: PathMatcher<CollectionDefinition<any, any>>,
		documentSavingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>,
		documentSavedListenersMatcher: PathMatcher<DocumentListener<any, any>>,
		documentDeletingListenersMatcher: PathMatcher<DocumentAtomicListener<any, any>>,
		documentDeletedListenersMatcher: PathMatcher<DocumentListener<any, any>>,
		context: Context<any, any, any>,
		provider: DocumentProvider,
	) {
		super();
		this.#documentMatcher = documentMatcher;
		this.#collectionMatcher = collectionMatcher;
		this.#documentSavingListenersMatcher = documentSavingListenersMatcher;
		this.#documentSavedListenersMatcher = documentSavedListenersMatcher;
		this.#documentDeletingListenersMatcher = documentDeletingListenersMatcher;
		this.#documentDeletedListenersMatcher = documentDeletedListenersMatcher;
		this.#context = context;
		this.#provider = provider;
	}

	async commit(): Promise<void> {
		const atomic = this.#provider.atomic();
		for (const check of this.checks) {
			atomic.check(check.key, check.versionstamp);
		}
		const opsCache: Array<{
			document?: Document<unknown>;
			op: CommandDocumentAtomicOp;
		}> = [];
		for (const op of this.ops) {
			const document = op.type === "set"
				? { key: op.key, data: op.data, versionstamp: "" }
				: undefined;
			const firstResult = this.#documentMatcher(op.key).next();
			if (firstResult.done) {
				throw new UnknownDocumentError();
			}
			if (op.type === "delete") {
				atomic.delete(op.key);
				for (const event of this.#documentDeletingListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({
						context: this.#context,
						params,
						document: undefined,
						atomic,
					});
				}
			} else {
				atomic.set(op.key, op.data);
				for (const event of this.#documentSavingListenersMatcher(op.key)) {
					const params = PathAsType(event.path, op.key);
					await event.handler({
						context: this.#context,
						params,
						document,
						atomic,
					});
				}
			}
			opsCache.push({ document, op });
		}
		await atomic.commit();
		for (const { op, document } of opsCache) {
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
