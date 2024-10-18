// deno-lint-ignore-file no-explicit-any
import { createPathMatcher, PathAsType, PathMatcher } from "@baseless/core/path";
import {
	type CollectionDefinition,
	Context,
	type Decorator,
	DocumentAtomicDeleteListener,
	DocumentAtomicSetListener,
	type DocumentDefinition,
	DocumentDeleteListener,
	DocumentSetListener,
	type EventDefinition,
	type EventListener,
	hasPermission,
	HubListener,
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
import { EventProvider } from "./event_provider.ts";
import type { ID } from "@baseless/core/id";

export class Application<TDependencies extends {} = {}> {
	#decorators: ReadonlyArray<Decorator<any>>;
	#eventMatcher: PathMatcher<EventDefinition<any, any>>;
	#rpcMatcher: PathMatcher<RpcDefinition<any, any, any>>;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any>>;
	#eventListenersMatcher: PathMatcher<EventListener<any, any>>;
	#hubConnectedListenersMatcher: Array<HubListener>;
	#hubDisconnectedListenersMatcher: Array<HubListener>;
	#documentSavingListenersMatcher: PathMatcher<DocumentAtomicSetListener<any, any>>;
	#documentSavedListenersMatcher: PathMatcher<DocumentSetListener<any, any>>;
	#documentDeletingListenersMatcher: PathMatcher<DocumentAtomicDeleteListener<any, any>>;
	#documentDeletedListenersMatcher: PathMatcher<DocumentDeleteListener<any>>;

	constructor(
		decorators: ReadonlyArray<Decorator<any>>,
		rpcDefinitions: ReadonlyArray<RpcDefinition<any, any, any>>,
		eventDefinitions: ReadonlyArray<EventDefinition<any, any>>,
		documentDefinitions: ReadonlyArray<DocumentDefinition<any, any>>,
		collectionDefinitions: ReadonlyArray<CollectionDefinition<any, any>>,
		eventListeners: ReadonlyArray<EventListener<any, any>>,
		hubConnectedListeners: ReadonlyArray<HubListener>,
		hubDisconnectedListeners: ReadonlyArray<HubListener>,
		documentSavingListeners: ReadonlyArray<DocumentAtomicSetListener<any, any>>,
		documentSavedListeners: ReadonlyArray<DocumentSetListener<any, any>>,
		documentDeletingListeners: ReadonlyArray<DocumentAtomicDeleteListener<any, any>>,
		documentDeletedListeners: ReadonlyArray<DocumentDeleteListener<any>>,
	) {
		this.#decorators = decorators;
		this.#eventMatcher = createPathMatcher(eventDefinitions);
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
		this.#eventListenersMatcher = createPathMatcher(eventListeners);
		this.#hubConnectedListenersMatcher = [...hubConnectedListeners];
		this.#hubDisconnectedListenersMatcher = [...hubDisconnectedListeners];
		this.#documentSavingListenersMatcher = createPathMatcher(documentSavingListeners);
		this.#documentSavedListenersMatcher = createPathMatcher(documentSavedListeners);
		this.#documentDeletingListenersMatcher = createPathMatcher(documentDeletingListeners);
		this.#documentDeletedListenersMatcher = createPathMatcher(documentDeletedListeners);
	}

	async decorate(context: Context): Promise<void> {
		for (const decorator of this.#decorators) {
			const result = await decorator(context);
			Object.assign(context, result);
		}
	}

	async invokeRpc({ bypassSecurity, context, input, rpc }: {
		bypassSecurity?: boolean;
		context: Context;
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
		context: Context;
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
		context: Context;
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
		context: Context;
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

	async commitDocumentAtomic({ bypassSecurity, checks, context, operations, documentProvider, eventProvider }: {
		bypassSecurity?: boolean;
		checks: DocumentAtomicCheck[];
		context: Context;
		operations: DocumentAtomicOperation[];
		documentProvider: DocumentProvider;
		eventProvider: EventProvider;
	}): Promise<void> {
		if (bypassSecurity !== true) {
			await this.getManyDocument({
				paths: checks.map((c) => c.key),
				context,
				provider: documentProvider,
			});
		}
		const atomic = documentProvider.atomic();
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
			await this.publishEvent({
				context,
				event: ["$document", ...op.key],
				payload: op,
				provider: eventProvider,
			}).catch((_) => {});
			const collection = this.#collectionMatcher(op.key.slice(0, -1)).next();
			if (!collection.done) {
				await this.publishEvent({
					context,
					event: ["$collection", ...collection.value.path],
					payload: op,
					provider: eventProvider,
				}).catch((_) => {});
			}
		}
	}

	async connectHub({ context, hubId }: {
		context: Context;
		hubId: ID<"hub_">;
	}): Promise<void> {
		for (const listener of this.#hubConnectedListenersMatcher) {
			await listener.handler({ context, hubId });
		}
	}

	async disconnectHub({ context, hubId }: {
		context: Context;
		hubId: ID<"hub_">;
	}): Promise<void> {
		for (const listener of this.#hubDisconnectedListenersMatcher) {
			await listener.handler({ context, hubId });
		}
	}

	async publishEvent({ bypassSecurity, context, event, payload, provider }: {
		bypassSecurity?: boolean;
		context: Context;
		event: string[];
		payload: unknown;
		provider: EventProvider;
	}): Promise<void> {
		const firstResult = this.#eventMatcher(event).next();
		if (firstResult.done) {
			throw new UnknownRpcError();
		}
		const definition = firstResult.value;
		if (!Value.Check(definition.payload, payload)) {
			throw new InvalidPayloadError();
		}
		const definitionOptions = {
			context,
			params: PathAsType(definition.path, event),
			payload,
		};
		if (
			bypassSecurity !== true &&
			(
				!("security" in definition) ||
				!hasPermission(await definition.security(definitionOptions), Permission.Publish)
			)
		) {
			throw new ForbiddenError();
		}
		await provider.publish(event, payload);
		for (const listener of this.#eventListenersMatcher(event)) {
			const params = PathAsType(listener.path, event);
			await listener.handler({ context, params, payload }).catch((_) => {});
		}
	}

	async subscribeEvent({ bypassSecurity, context, event, hubId, provider }: {
		bypassSecurity?: boolean;
		context: Context;
		event: string[];
		hubId: ID<"hub_">;
		provider: EventProvider;
	}): Promise<void> {
		const firstResult = this.#eventMatcher(event).next();
		if (firstResult.done) {
			throw new UnknownRpcError();
		}
		const definition = firstResult.value;
		const definitionOptions = {
			context,
			params: PathAsType(definition.path, event),
		};
		if (
			bypassSecurity !== true &&
			(
				!("security" in definition) ||
				!hasPermission(await definition.security(definitionOptions), Permission.Subscribe)
			)
		) {
			throw new ForbiddenError();
		}
		await provider.subscribe(event, hubId);
	}

	async unsubscribeEvent({ bypassSecurity, context, event, hubId, provider }: {
		bypassSecurity?: boolean;
		context: Context;
		event: string[];
		hubId: ID<"hub_">;
		provider: EventProvider;
	}): Promise<void> {
		const firstResult = this.#eventMatcher(event).next();
		if (firstResult.done) {
			throw new UnknownRpcError();
		}
		const definition = firstResult.value;
		const definitionOptions = {
			context,
			params: PathAsType(definition.path, event),
		};
		if (
			bypassSecurity !== true &&
			(
				!("security" in definition) ||
				!hasPermission(await definition.security(definitionOptions), Permission.Subscribe)
			)
		) {
			throw new ForbiddenError();
		}
		await provider.unsubscribe(event, hubId);
	}

	async unsubscribeAllEvent({ bypassSecurity, context, hubId, provider }: {
		bypassSecurity?: boolean;
		context: Context;
		hubId: ID<"hub_">;
		provider: EventProvider;
	}): Promise<void> {
		// TODO security?
		await provider.unsubscribeAll(hubId);
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
