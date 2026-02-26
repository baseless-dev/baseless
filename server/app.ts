// deno-lint-ignore-file ban-types no-explicit-any
import * as z from "@baseless/core/schema";
import { type Matcher, matchPath, type PathToParams } from "@baseless/core/path";
import type { DocumentServiceAtomic, ServiceCollection } from "./service.ts";
import type { ID } from "@baseless/core/id";
import type { ExpressionBuilder, TBooleanComparisonExpression, TBooleanExpression } from "@baseless/core/query";
import { Document } from "@baseless/core/document";
import { Request } from "@baseless/core/request";
import { Response } from "@baseless/core/response";
import type { Prettify } from "@baseless/core/prettify";
import { KeyLike } from "jose";

// deno-fmt-ignore
/** Bit-field flags for access control on endpoints, documents, collections, topics, and tables. */
export const Permission = {
	None:		0b000000000,
	All:		0b111111111,
	Get:		0b000000001,
	Set:		0b000000010,
	Delete:		0b000000100,
	List:		0b000001000,
	Publish:	0b000010000,
	Subscribe:	0b000100000,
	Select:		0b001000000,
	Insert:		0b010000000,
	Update:		0b100000000,
} as const;
/** Numeric bit-field type representing a set of {@link Permission} flags. */
export type Permission = number;

/**
 * The resolved authentication context for a request — either an
 * `{ identityId, scope }` object or `undefined` for unauthenticated requests.
 */
export type Auth =
	| {
		identityId: ID<"id_">;
		scope: string[];
	}
	| undefined;

/**
 * Type-level registry that describes all resources (collections, documents,
 * topics, tables, services, context) registered with an {@link App}.
 */
export interface AppRegistry {
	collections: {};
	configuration: {
		auth?:
			| { keyPublic: KeyLike }
			| {
				accessTokenTTL: number;
				keyAlgo: string;
				keyPublic: KeyLike;
				keyPrivate: KeyLike;
				keySecret: Uint8Array;
				refreshTokenTTL: number;
			};
	};
	context: {};
	documents: {};
	requirements: {
		configuration: {};
		context: {};
		collections: {};
		documents: {};
		services: {};
		tables: {};
		topics: {};
	};
	services: {};
	tables: {};
	topics: {};
}

/**
 * The public subset of an {@link AppRegistry} exposed to clients (endpoints,
 * collections, documents, tables, topics).
 */
export interface PublicAppRegistry {
	endpoints: {};
	collections: {};
	documents: {};
	tables: {};
	topics: {};
}

/**
 * A value (or async factory function) that adds properties to the request
 * context before the handler runs.
 */
export type DecorationHandler<TRegistry extends AppRegistry, TDecoration extends {}> =
	| TDecoration
	| ((options: {
		app: App;
		auth: Auth;
		configuration: TRegistry["configuration"];
		service: ServiceCollection<TRegistry>;
		request: Request;
		signal: AbortSignal;
		waitUntil: (promise: PromiseLike<unknown>) => void;
	}) => TDecoration | Promise<TDecoration>);

/**
 * A value (or async factory function) that produces additional service objects
 * to expose in the {@link ServiceCollection}.
 */
export type ServiceHandler<TRegistry extends AppRegistry, TService extends {}> =
	| TService
	| ((options: {
		app: App;
		auth: Auth;
		configuration: TRegistry["configuration"];
		request: Request;
		signal: AbortSignal;
		waitUntil: (promise: PromiseLike<unknown>) => void;
	}) => TService | Promise<TService>);

/**
 * Handler function for a typed API endpoint. Receives the full request
 * context and returns a typed response.
 */
export type RequestHandler<
	TRegistry extends AppRegistry,
	TParams extends {},
	TRequest extends Request,
	TResponse extends Response,
> =
	| TResponse
	| ((options: {
		app: App;
		auth: Auth;
		configuration: TRegistry["configuration"];
		context: TRegistry["context"];
		request: TRequest;
		params: TParams;
		service: ServiceCollection<TRegistry>;
		signal: AbortSignal;
		waitUntil: (promise: PromiseLike<unknown>) => void;
	}) => TResponse | Promise<TResponse>);

/**
 * Security handler that determines which {@link Permission} flags the current
 * principal has for a given endpoint request.
 */
export type RequestSecurityHandler<TRegistry extends AppRegistry, TParams extends {}, TRequest extends Request> = (
	options: {
		app: App;
		auth: Auth;
		configuration: TRegistry["configuration"];
		context: TRegistry["context"];
		request: TRequest;
		params: TParams;
		service: ServiceCollection<TRegistry>;
		signal: AbortSignal;
		waitUntil: (promise: PromiseLike<unknown>) => void;
	},
) => Permission | Promise<Permission>;

/**
 * Security handler that determines which {@link Permission} flags the current
 * principal has for a given document (read/write/delete/list).
 */
export type DocumentSecurityHandler<TRegistry extends AppRegistry, TParams extends {}, TData> = (options: {
	app: App;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	document?: TData;
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

/**
 * Hook called just before a document is created or updated.
 * Use it to perform side-effects inside the same atomic batch.
 */
export type DocumentSettingHandler<TRegistry extends AppRegistry, TParams extends {}, TData> = (options: {
	app: App;
	atomic: DocumentServiceAtomic<TRegistry["documents"]>;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	document: Document<TData>;
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => void | Promise<void>;

/**
 * Hook called just before a document is deleted.
 * Use it to perform side-effects inside the same atomic batch.
 */
export type DocumentDeletingHandler<TRegistry extends AppRegistry, TParams extends {}, TData> = (options: {
	app: App;
	atomic: DocumentServiceAtomic<TRegistry["documents"]>;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => void | Promise<void>;

/**
 * Security handler that determines which {@link Permission} flags the current
 * principal has for operations on a collection (list, set, delete).
 */
export type CollectionSecurityHandler<TRegistry extends AppRegistry, TParams extends {}> = (options: {
	app: App;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

/**
 * Security handler that determines which {@link Permission} flags the current
 * principal has for table-level (DDL) operations.
 */
export type TableTableSecurityHandler<TRegistry extends AppRegistry, TParams extends {}, TName extends string, TData> = (options: {
	app: App;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

/**
 * Row-level security handler that returns a boolean expression used to filter
 * rows the current principal is allowed to see.
 */
export type TableRowSecurityHandler<TRegistry extends AppRegistry, TParams extends {}, TName extends string, TData> = (options: {
	app: App;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	q: ExpressionBuilder<{ [a in TName]: TData }, {}>;
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => TBooleanComparisonExpression<{}> | TBooleanExpression<{}> | Promise<TBooleanComparisonExpression<{}> | TBooleanExpression<{}>>;

/** A typed message delivered to a topic handler. */
export type TopicMessage<TData> = {
	topic: string;
	data: TData;
	stopPropagation: boolean;
	stopImmediatePropagation: boolean;
};

/**
 * Handler invoked for each message published to a topic the app has
 * subscribed to via {@link AppBuilder.onTopicMessage}.
 */
export type TopicMessageHandler<TRegistry extends AppRegistry, TParams extends {}, TMessage> = (options: {
	app: App;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	message: TopicMessage<TMessage>;
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => void | Promise<void>;

/**
 * Security handler that determines which {@link Permission} flags
 * (publish/subscribe) the current principal has for a topic.
 */
export type TopicMessageSecurityHandler<TRegistry extends AppRegistry, TParams extends {}, TMessage> = (options: {
	app: App;
	auth: Auth;
	configuration: TRegistry["configuration"];
	context: TRegistry["context"];
	message?: TMessage;
	params: TParams;
	service: ServiceCollection<TRegistry>;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

/**
 * Utility type that checks whether `TRegistry` satisfies all requirements
 * declared by `TOtherRegistry`; yields an {@link AppBuilder} on success, or
 * `never` on failure.
 */
// deno-fmt-ignore
export type AppRegistryMetRequirements<TRegistry extends AppRegistry, TOtherRegistry extends AppRegistry, TOtherPublicRegistry extends PublicAppRegistry> =
	TRegistry["context"] extends TOtherRegistry["requirements"]["context"]
		? TRegistry["services"] extends TOtherRegistry["requirements"]["services"]
			? TRegistry["collections"] extends TOtherRegistry["requirements"]["collections"]
				? TRegistry["documents"] extends TOtherRegistry["requirements"]["documents"]
					? TRegistry["topics"] extends TOtherRegistry["requirements"]["topics"]
						? TRegistry["tables"] extends TOtherRegistry["requirements"]["tables"]
							? AppBuilder<TOtherRegistry, TOtherPublicRegistry>
							: never
						: never
					: never
				: never
			: never
		: never;

/** Server-private collection definition (not exposed to clients). */
export interface ServerCollectionDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
}

/** Public collection definition including security handlers. */
export interface PublicCollectionDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
	collectionSecurity: CollectionSecurityHandler<TRegistry, PathToParams<TPath>>;
	documentSecurity: DocumentSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
	topicSecurity: TopicMessageSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
}

/** Union of {@link ServerCollectionDefinition} and {@link PublicCollectionDefinition}. */
export type CollectionDefinition = ServerCollectionDefinition<any, any, any> | PublicCollectionDefinition<any, any, any>;

/** Server-private document definition (not exposed to clients). */
export interface ServerDocumentDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
}

/** Public document definition including security handlers. */
export interface PublicDocumentDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
	documentSecurity: DocumentSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
	topicSecurity: TopicMessageSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
}

/** Union of {@link ServerDocumentDefinition} and {@link PublicDocumentDefinition}. */
export type DocumentDefinition = ServerDocumentDefinition<any, any, any> | PublicDocumentDefinition<any, any, any>;

/** Definition of a document `onSetting` lifecycle hook registered via {@link AppBuilder.onDocumentSetting}. */
export interface OnDocumentSettingDefinition<
	TRegistry extends AppRegistry,
	TPath extends keyof TRegistry["documents"],
> {
	path: TPath;
	handler: DocumentSettingHandler<TRegistry, PathToParams<TPath>, TRegistry["documents"][TPath]>;
}

/** Definition of a document `onDeleting` lifecycle hook registered via {@link AppBuilder.onDocumentDeleting}. */
export interface OnDocumentDeletingDefinition<
	TRegistry extends AppRegistry,
	TPath extends keyof TRegistry["documents"],
> {
	path: TPath;
	handler: DocumentDeletingHandler<TRegistry, PathToParams<TPath>, TRegistry["documents"][TPath]>;
}

/** Definition of a typed API endpoint registered via {@link AppBuilder.endpoint}. */
export interface EndpointDefinition<
	TRegistry extends AppRegistry,
	TPath extends string,
	TRequest extends z.ZodRequest<any, any, any, any>,
	TResponse extends z.ZodResponse<any, any, any> | z.ZodUnion<z.ZodResponse<any, any, any>[]>,
> {
	path: TPath;
	request: TRequest;
	response: TResponse;
	handler: RequestHandler<TRegistry, PathToParams<TPath>, z.infer<TRequest>, z.infer<TResponse>>;
}

/** Server-private table definition (not exposed to clients). */
export interface ServerTableDefinition<
	TRegistry extends AppRegistry,
	TName extends string,
	TData extends z.ZodObject,
> {
	path: TName;
	schema: TData;
}

/** Public table definition including security handlers. */
export interface PublicTableDefinition<
	TRegistry extends AppRegistry,
	TName extends string,
	TData extends z.ZodObject,
> {
	path: TName;
	schema: TData;
	tableSecurity: TableTableSecurityHandler<TRegistry, {}, TName, z.infer<TData>>;
	rowSecurity: TableRowSecurityHandler<TRegistry, {}, TName, z.infer<TData>>;
}

/** Union of {@link ServerTableDefinition} and {@link PublicTableDefinition}. */
export type TableDefinition = ServerTableDefinition<any, any, any> | PublicTableDefinition<any, any, any>;

/** Server-private topic definition (not exposed to clients). */
export interface ServerTopicDefinition<
	TRegistry extends AppRegistry,
	TPath extends string,
	TData extends z.ZodType,
> {
	path: TPath;
	schema: TData;
}

/** Public topic definition including a subscribe/publish security handler. */
export interface PublicTopicDefinition<
	TRegistry extends AppRegistry,
	TPath extends string,
	TData extends z.ZodType,
> {
	path: TPath;
	schema: TData;
	security: TopicMessageSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
}

/** Union of {@link ServerTopicDefinition} and {@link PublicTopicDefinition}. */
export type TopicDefinition = ServerTopicDefinition<any, any, any> | PublicTopicDefinition<any, any, any>;

/** Definition of a topic `onMessage` handler registered via {@link AppBuilder.onTopicMessage}. */
export interface OnTopicMessageDefinition<
	TRegistry extends AppRegistry,
	TPath extends keyof TRegistry["topics"],
> {
	path: TPath;
	handler: TopicMessageHandler<TRegistry, PathToParams<TPath>, TRegistry["topics"][TPath]>;
}

/**
 * Fluent builder for composing a Baseless server application. Obtain a fresh
 * instance via {@link app}.
 *
 * Each method returns a new `AppBuilder` with the TypeScript registry updated
 * to reflect the added resources.
 *
 * @example
 * ```ts
 * import { app } from "@baseless/server";
 * import * as z from "@baseless/core/schema";
 *
 * const myApp = app()
 *   .collection({ path: "posts", schema: z.object({ title: z.string() }), ... })
 *   .endpoint({ path: "hello", request: z.request(), response: z.jsonResponse({ greeting: z.string() }), handler: () => Response.json({ greeting: "hi" }) })
 *   .build();
 * ```
 */
export class AppBuilder<TServerRegistry extends AppRegistry, TPublicRegistry extends PublicAppRegistry> {
	#app: ConstructorParameters<typeof App>[0];

	constructor(app: ConstructorParameters<typeof App>[0]) {
		this.#app = app;
	}

	/** Finalizes the builder and returns an immutable {@link App} instance. */
	build(): App<TServerRegistry, TPublicRegistry> {
		return new App(this.#app);
	}

	decorate<TDecoration extends {}>(
		constructor: DecorationHandler<TServerRegistry, TDecoration>,
	): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: Prettify<TServerRegistry["context"] & TDecoration>;
		documents: TServerRegistry["documents"];
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			decorators: [...this.#app.decorators ?? [], constructor],
		});
	}

	/**
	 * Registers a collection definition, automatically creating the backing
	 * document path (`{path}/:key`) and topic paths.
	 * Pass a {@link PublicCollectionDefinition} (with `collectionSecurity`,
	 * `documentSecurity`, and `topicSecurity`) to expose it to clients, or a
	 * {@link ServerCollectionDefinition} to keep it server-private.
	 * @param definition The collection definition to register.
	 * @returns A new builder with the collection added to the registry.
	 */
	collection<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: PublicCollectionDefinition<TServerRegistry, TPath, TData>): AppBuilder<{
		collections: Prettify<TServerRegistry["collections"] & { [k in TPath]: z.infer<TData> }>;
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: Prettify<TServerRegistry["documents"] & { [k in `${TPath}/:key`]: z.infer<TData> }>;
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: Prettify<TServerRegistry["topics"] & { [k in TPath]: z.infer<TData> } & { [k in `${TPath}/:key`]: z.infer<TData> }>;
	}, {
		endpoints: TPublicRegistry["endpoints"];
		collections: Prettify<TPublicRegistry["collections"] & { [k in TPath]: z.infer<TData> }>;
		documents: Prettify<TPublicRegistry["documents"] & { [k in `${TPath}/:key`]: z.infer<TData> }>;
		tables: TPublicRegistry["tables"];
		topics: Prettify<TPublicRegistry["topics"] & { [k in TPath]: z.infer<TData> } & { [k in `${TPath}/:key`]: z.infer<TData> }>;
	}>;
	collection<
		TPath extends string,
		TData extends z.ZodType,
	>(
		definition: ServerCollectionDefinition<TServerRegistry, TPath, TData>,
	): AppBuilder<{
		collections: Prettify<TServerRegistry["collections"] & { [k in TPath]: z.infer<TData> }>;
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: Prettify<TServerRegistry["documents"] & { [k in `${TPath}/:key`]: z.infer<TData> }>;
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: Prettify<TServerRegistry["topics"] & { [k in TPath]: z.infer<TData> } & { [k in `${TPath}/:key`]: z.infer<TData> }>;
	}, TPublicRegistry>;
	collection<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: PublicCollectionDefinition<TServerRegistry, TPath, TData>): AppBuilder<any, any> {
		return new AppBuilder<any, any>({
			...this.#app,
			collections: { ...this.#app.collections, [definition.path]: definition as never },
		});
	}

	/**
	 * Registers a standalone document definition.
	 * Pass a {@link PublicDocumentDefinition} (with `documentSecurity` and
	 * `topicSecurity`) to expose it to clients, or a
	 * {@link ServerDocumentDefinition} to keep it server-private.
	 * @param definition The document definition to register.
	 * @returns A new builder with the document added to the registry.
	 */
	document<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: PublicDocumentDefinition<TServerRegistry, TPath, TData>): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: Prettify<TServerRegistry["documents"] & { [k in TPath]: z.infer<TData> }>;
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: Prettify<TServerRegistry["topics"] & { [k in TPath]: z.infer<TData> }>;
	}, {
		endpoints: TPublicRegistry["endpoints"];
		collections: TPublicRegistry["collections"];
		documents: Prettify<TPublicRegistry["documents"] & { [k in TPath]: z.infer<TData> }>;
		tables: TPublicRegistry["tables"];
		topics: Prettify<TPublicRegistry["topics"] & { [k in TPath]: z.infer<TData> }>;
	}>;
	document<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: ServerDocumentDefinition<TServerRegistry, TPath, TData>): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: Prettify<TServerRegistry["documents"] & { [k in TPath]: z.infer<TData> }>;
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: Prettify<TServerRegistry["topics"] & { [k in TPath]: z.infer<TData> }>;
	}, TPublicRegistry>;
	document<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: PublicDocumentDefinition<TServerRegistry, TPath, TData>): AppBuilder<any, any> {
		return new AppBuilder<any, any>({
			...this.#app,
			documents: { ...this.#app.documents, [definition.path]: definition as never },
		});
	}

	/**
	 * Registers a typed HTTP endpoint.
	 * @param definition The endpoint definition including its `path`, `request`
	 * schema, `response` schema, and `handler`.
	 * @returns A new builder with the endpoint added to the public registry.
	 */
	endpoint<
		TPath extends string,
		TRequest extends z.ZodRequest<any, any, any, any>,
		TResponse extends z.ZodResponse<any, any, any> | z.ZodUnion<z.ZodResponse<any, any, any>[]>,
	>(
		definition: EndpointDefinition<TServerRegistry, TPath, TRequest, TResponse>,
	): AppBuilder<TServerRegistry, {
		endpoints: Prettify<TPublicRegistry["endpoints"] & { [k in TPath]: { request: z.infer<TRequest>; response: z.infer<TResponse> } }>;
		collections: TPublicRegistry["collections"];
		documents: TPublicRegistry["documents"];
		tables: TPublicRegistry["tables"];
		topics: TPublicRegistry["topics"];
	}> {
		const endpoints = { ...this.#app.endpoints };
		endpoints[definition.path] ??= {};
		endpoints[definition.path]![definition.request.def.params?.method.toLowerCase()] = definition as never;
		return new AppBuilder<any, any>({
			...this.#app,
			endpoints,
		});
	}

	/**
	 * Registers a {@link ServiceHandler} that produces additional service
	 * objects available to all handlers via the `service` parameter.
	 * @param constructor The service value or async factory.
	 * @returns A new builder with the extended services type.
	 */
	service<TServices extends {}>(
		constructor: ServiceHandler<TServerRegistry, TServices>,
	): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: TServerRegistry["requirements"];
		services: Prettify<TServerRegistry["services"] & TServices>;
		tables: TServerRegistry["tables"];
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			services: [...this.#app.services ?? [], constructor],
		});
	}

	/**
	 * Registers a SQL table definition.
	 * Pass a {@link PublicTableDefinition} (with `tableSecurity` and
	 * `rowSecurity`) to expose it to clients, or a
	 * {@link ServerTableDefinition} to keep it server-private.
	 * @param definition The table definition to register.
	 * @returns A new builder with the table added to the registry.
	 */
	table<
		TName extends string,
		TData extends z.ZodObject,
	>(definition: PublicTableDefinition<TServerRegistry, TName, TData>): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: Prettify<TServerRegistry["tables"] & { [k in TName]: z.infer<TData> }>;
		topics: TServerRegistry["topics"];
	}, {
		endpoints: TPublicRegistry["endpoints"];
		collections: TPublicRegistry["collections"];
		documents: TPublicRegistry["documents"];
		tables: Prettify<TPublicRegistry["tables"] & { [k in TName]: z.infer<TData> }>;
		topics: TPublicRegistry["topics"];
	}>;
	table<
		TName extends string,
		TData extends z.ZodObject,
	>(definition: ServerTableDefinition<TServerRegistry, TName, TData>): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: Prettify<TServerRegistry["tables"] & { [k in TName]: z.infer<TData> }>;
		topics: TServerRegistry["topics"];
	}, TPublicRegistry>;
	table<
		TName extends string,
		TData extends z.ZodObject,
	>(definition: PublicTableDefinition<TServerRegistry, TName, TData>): AppBuilder<any, any> {
		return new AppBuilder<any, any>({
			...this.#app,
			tables: { ...this.#app.tables, [definition.path]: definition as never },
		});
	}

	/**
	 * Registers a pub/sub topic definition.
	 * Pass a {@link PublicTopicDefinition} (with a `security` handler) to
	 * expose it to clients, or a {@link ServerTopicDefinition} to keep it
	 * server-private.
	 * @param definition The topic definition to register.
	 * @returns A new builder with the topic added to the registry.
	 */
	topic<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: PublicTopicDefinition<TServerRegistry, TPath, TData>): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: Prettify<TServerRegistry["topics"] & { [k in TPath]: z.infer<TData> }>;
	}, {
		endpoints: TPublicRegistry["endpoints"];
		collections: TPublicRegistry["collections"];
		documents: TPublicRegistry["documents"];
		tables: TPublicRegistry["tables"];
		topics: Prettify<TPublicRegistry["topics"] & { [k in TPath]: z.infer<TData> }>;
	}>;
	topic<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: ServerTopicDefinition<TServerRegistry, TPath, TData>): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: TServerRegistry["requirements"];
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: Prettify<TServerRegistry["topics"] & { [k in TPath]: z.infer<TData> }>;
	}, TPublicRegistry>;
	topic<
		TPath extends string,
		TData extends z.ZodType,
	>(definition: PublicTopicDefinition<TServerRegistry, TPath, TData>): AppBuilder<any, any> {
		return new AppBuilder<any, any>({
			...this.#app,
			topics: { ...this.#app.topics, [definition.path]: definition as never },
		});
	}

	/**
	 * Merges another {@link AppBuilder}'s registrations into this one,
	 * combining all collections, documents, endpoints, topics, tables,
	 * decorators, services, and lifecycle hooks.
	 *
	 * The TypeScript compiler enforces that this builder's registry satisfies
	 * all requirements declared by `other` via
	 * {@link AppRegistryMetRequirements}.
	 *
	 * @param other The app builder to merge in.
	 * @returns A new builder with the merged registries.
	 */
	extend<TOtherRegistry extends AppRegistry, TOtherPublicRegistry extends PublicAppRegistry>(
		other: AppRegistryMetRequirements<TServerRegistry, TOtherRegistry, TOtherPublicRegistry>,
	): AppBuilder<{
		collections: Prettify<TServerRegistry["collections"] & TOtherRegistry["collections"]>;
		configuration: Prettify<TServerRegistry["configuration"] & TOtherRegistry["configuration"]>;
		context: Prettify<TServerRegistry["context"] & TOtherRegistry["context"]>;
		documents: Prettify<TServerRegistry["documents"] & TOtherRegistry["documents"]>;
		requirements: Prettify<{
			configuration: Prettify<TServerRegistry["requirements"]["configuration"] & TOtherRegistry["requirements"]["configuration"]>;
			context: Prettify<TServerRegistry["requirements"]["context"] & TOtherRegistry["requirements"]["context"]>;
			collections: Prettify<TServerRegistry["requirements"]["collections"] & TOtherRegistry["requirements"]["collections"]>;
			documents: Prettify<TServerRegistry["requirements"]["documents"] & TOtherRegistry["requirements"]["documents"]>;
			services: Prettify<TServerRegistry["requirements"]["services"] & TOtherRegistry["requirements"]["services"]>;
			tables: Prettify<TServerRegistry["requirements"]["tables"] & TOtherRegistry["requirements"]["tables"]>;
			topics: Prettify<TServerRegistry["requirements"]["topics"] & TOtherRegistry["requirements"]["topics"]>;
		}>;
		services: Prettify<TServerRegistry["services"] & TOtherRegistry["services"]>;
		tables: Prettify<TServerRegistry["tables"] & TOtherRegistry["tables"]>;
		topics: Prettify<TServerRegistry["topics"] & TOtherRegistry["topics"]>;
	}, {
		endpoints: Prettify<TPublicRegistry["endpoints"] & TOtherPublicRegistry["endpoints"]>;
		collections: Prettify<TPublicRegistry["collections"] & TOtherPublicRegistry["collections"]>;
		documents: Prettify<TPublicRegistry["documents"] & TOtherPublicRegistry["documents"]>;
		tables: Prettify<TPublicRegistry["tables"] & TOtherPublicRegistry["tables"]>;
		topics: Prettify<TPublicRegistry["topics"] & TOtherPublicRegistry["topics"]>;
	}> {
		return new AppBuilder<any, any>({
			collections: { ...this.#app.collections, ...other.#app.collections },
			decorators: [...this.#app.decorators, ...other.#app.decorators],
			documents: { ...this.#app.documents, ...other.#app.documents },
			endpoints: { ...this.#app.endpoints, ...other.#app.endpoints },
			onDocumentSetting: [...this.#app.onDocumentSetting, ...other.#app.onDocumentSetting],
			onDocumentDeleting: [...this.#app.onDocumentDeleting, ...other.#app.onDocumentDeleting],
			onTopicMessage: [...this.#app.onTopicMessage, ...other.#app.onTopicMessage],
			requirements: {
				configuration: { ...this.#app.requirements?.configuration, ...other.#app.requirements?.configuration },
				context: { ...this.#app.requirements?.context, ...other.#app.requirements?.context },
				collections: { ...this.#app.requirements?.collections, ...other.#app.requirements?.collections },
				documents: { ...this.#app.requirements?.documents, ...other.#app.requirements?.documents },
				services: { ...this.#app.requirements?.services, ...other.#app.requirements?.services },
				tables: { ...this.#app.requirements?.tables, ...other.#app.requirements?.tables },
				topics: { ...this.#app.requirements?.topics, ...other.#app.requirements?.topics },
			},
			services: [...this.#app.services, ...other.#app.services],
			tables: { ...this.#app.tables, ...other.#app.tables },
			topics: { ...this.#app.topics, ...other.#app.topics },
		});
	}

	/**
	 * Registers an {@link OnDocumentSettingDefinition} lifecycle hook that is
	 * called just before a matching document is created or updated.
	 * @param definition Hook definition with `path` and `handler`.
	 * @returns A new builder with the hook registered.
	 */
	onDocumentSetting<TPath extends keyof TServerRegistry["documents"]>(
		definition: OnDocumentSettingDefinition<TServerRegistry, TPath>,
	): AppBuilder<TServerRegistry, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			onDocumentSetting: [...this.#app.onDocumentSetting, definition as never],
		});
	}

	/**
	 * Registers an {@link OnDocumentDeletingDefinition} lifecycle hook that is
	 * called just before a matching document is deleted.
	 * @param definition Hook definition with `path` and `handler`.
	 * @returns A new builder with the hook registered.
	 */
	onDocumentDeleting<TPath extends keyof TServerRegistry["documents"]>(
		definition: OnDocumentDeletingDefinition<TServerRegistry, TPath>,
	): AppBuilder<TServerRegistry, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			onDocumentDeleting: [...this.#app.onDocumentDeleting, definition as never],
		});
	}

	/**
	 * Registers an {@link OnTopicMessageDefinition} handler invoked for each
	 * message published to a matching topic.
	 * @param definition Handler definition with `path` and `handler`.
	 * @returns A new builder with the handler registered.
	 */
	onTopicMessage<TPath extends keyof TServerRegistry["topics"]>(
		definition: OnTopicMessageDefinition<TServerRegistry, TPath>,
	): AppBuilder<TServerRegistry, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			onTopicMessage: [...this.#app.onTopicMessage, definition as never],
		});
	}

	/**
	 * Declares that this app requires a collection with the given path and
	 * schema to be provided by the host app that calls {@link extend}.
	 * @param options Object with `path` and `schema`.
	 * @returns A new builder with the collection requirement added.
	 */
	requireCollection<TPath extends string, TData extends z.ZodType>(options: {
		path: TPath;
		schema: TData;
	}): AppBuilder<{
		collections: Prettify<TServerRegistry["collections"] & { [k in TPath]: z.infer<TData> }>;
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: Prettify<TServerRegistry["documents"] & { [k in `${TPath}/:key`]: z.infer<TData> }>;
		requirements: {
			configuration: TServerRegistry["requirements"]["configuration"];
			context: TServerRegistry["requirements"]["context"];
			collections: Prettify<TServerRegistry["requirements"]["collections"] & { [k in TPath]: z.infer<TData> }>;
			documents: TServerRegistry["requirements"]["documents"];
			services: TServerRegistry["requirements"]["services"];
			tables: TServerRegistry["requirements"]["tables"];
			topics: TServerRegistry["requirements"]["topics"];
		};
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			requirements: {
				...this.#app.requirements,
				collections: {
					...this.#app.requirements.collections,
					[options.path]: options.schema,
				},
			},
		});
	}

	/**
	 * Declares that this app requires certain configuration keys (with default
	 * values) to be supplied by the host application.
	 * @param defaults Record of required configuration keys and their defaults.
	 * @returns A new builder with the configuration requirements added.
	 */
	requireConfiguration<TRequirements extends {}>(
		defaults: TRequirements,
	): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: Prettify<TServerRegistry["configuration"] & TRequirements>;
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: {
			configuration: Prettify<TServerRegistry["requirements"]["configuration"] & TRequirements>;
			context: TServerRegistry["requirements"]["context"];
			collections: TServerRegistry["requirements"]["collections"];
			documents: TServerRegistry["requirements"]["documents"];
			services: TServerRegistry["requirements"]["services"];
			tables: TServerRegistry["requirements"]["tables"];
			topics: TServerRegistry["requirements"]["topics"];
		};
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			requirements: {
				...this.#app.requirements,
				configuration: {
					...this.#app.requirements.configuration,
					...defaults,
				},
			},
		});
	}

	/**
	 * Declares that this app requires certain context keys (with default
	 * values) to be provided by a {@link DecorationHandler} in the host app.
	 * @param defaults Record of required context keys and their defaults.
	 * @returns A new builder with the context requirements added.
	 */
	requireContext<TRequirements extends {}>(
		defaults: TRequirements,
	): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: Prettify<TServerRegistry["context"] & TRequirements>;
		documents: TServerRegistry["documents"];
		requirements: {
			configuration: TServerRegistry["requirements"]["configuration"];
			context: Prettify<TServerRegistry["requirements"]["context"] & TRequirements>;
			collections: TServerRegistry["requirements"]["collections"];
			documents: TServerRegistry["requirements"]["documents"];
			services: TServerRegistry["requirements"]["services"];
			tables: TServerRegistry["requirements"]["tables"];
			topics: TServerRegistry["requirements"]["topics"];
		};
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			requirements: {
				...this.#app.requirements,
				context: {
					...this.#app.requirements.collections,
					...defaults,
				},
			},
		});
	}

	/**
	 * Declares that this app requires a document with the given path and schema
	 * to be provided by the host app that calls {@link extend}.
	 * @param options Object with `path` and `schema`.
	 * @returns A new builder with the document requirement added.
	 */
	requireDocument<TPath extends string, TData extends z.ZodType>(options: {
		path: TPath;
		schema: TData;
	}): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: Prettify<TServerRegistry["documents"] & { [k in TPath]: z.infer<TData> }>;
		requirements: {
			configuration: TServerRegistry["requirements"]["configuration"];
			context: TServerRegistry["requirements"]["context"];
			collections: TServerRegistry["requirements"]["collections"];
			documents: Prettify<TServerRegistry["requirements"]["documents"] & { [k in TPath]: z.infer<TData> }>;
			services: TServerRegistry["requirements"]["services"];
			tables: TServerRegistry["requirements"]["tables"];
			topics: TServerRegistry["requirements"]["topics"];
		};
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			requirements: {
				...this.#app.requirements,
				documents: {
					...this.#app.requirements.documents,
					[options.path]: options.schema,
				},
			},
		});
	}

	/**
	 * Declares that this app requires certain service keys (with default
	 * values) to be registered by the host app via {@link service}.
	 * @param defaults Record of required service keys and their defaults.
	 * @returns A new builder with the service requirements added.
	 */
	requireService<TRequirements extends {}>(
		defaults: TRequirements,
	): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: {
			configuration: TServerRegistry["requirements"]["configuration"];
			context: TServerRegistry["requirements"]["context"];
			collections: TServerRegistry["requirements"]["collections"];
			documents: TServerRegistry["requirements"]["documents"];
			services: Prettify<TServerRegistry["requirements"]["services"] & TRequirements>;
			tables: TServerRegistry["requirements"]["tables"];
			topics: TServerRegistry["requirements"]["topics"];
		};
		services: Prettify<TServerRegistry["services"] & TRequirements>;
		tables: TServerRegistry["tables"];
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			requirements: {
				...this.#app.requirements,
				services: {
					...this.#app.requirements.services,
					...defaults,
				},
			},
		});
	}

	/**
	 * Declares that this app requires a table with the given name and schema
	 * to be provided by the host app that calls {@link extend}.
	 * @param options Object with `name` and `schema`.
	 * @returns A new builder with the table requirement added.
	 */
	requireTable<TName extends string, TData extends z.ZodType>(options: {
		name: TName;
		schema: TData;
	}): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: {
			configuration: TServerRegistry["requirements"]["configuration"];
			context: TServerRegistry["requirements"]["context"];
			collections: TServerRegistry["requirements"]["collections"];
			documents: TServerRegistry["requirements"]["documents"];
			services: TServerRegistry["requirements"]["services"];
			tables: Prettify<TServerRegistry["requirements"]["tables"] & { [k in TName]: z.infer<TData> }>;
			topics: TServerRegistry["requirements"]["topics"];
		};
		services: TServerRegistry["services"];
		tables: Prettify<TServerRegistry["tables"] & { [k in TName]: z.infer<TData> }>;
		topics: TServerRegistry["topics"];
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			requirements: {
				...this.#app.requirements,
				tables: {
					...this.#app.requirements.tables,
					[options.name]: options.schema,
				},
			},
		});
	}

	/**
	 * Declares that this app requires a topic with the given path and schema
	 * to be provided by the host app that calls {@link extend}.
	 * @param options Object with `path` and `schema`.
	 * @returns A new builder with the topic requirement added.
	 */
	requireTopic<TPath extends string, TData extends z.ZodType>(options: {
		path: TPath;
		schema: TData;
	}): AppBuilder<{
		collections: TServerRegistry["collections"];
		configuration: TServerRegistry["configuration"];
		context: TServerRegistry["context"];
		documents: TServerRegistry["documents"];
		requirements: {
			configuration: TServerRegistry["requirements"]["configuration"];
			context: TServerRegistry["requirements"]["context"];
			collections: TServerRegistry["requirements"]["collections"];
			documents: TServerRegistry["requirements"]["documents"];
			services: TServerRegistry["requirements"]["services"];
			tables: TServerRegistry["requirements"]["tables"];
			topics: Prettify<TServerRegistry["requirements"]["topics"] & { [k in TPath]: z.infer<TData> }>;
		};
		services: TServerRegistry["services"];
		tables: TServerRegistry["tables"];
		topics: Prettify<TServerRegistry["topics"] & { [k in TPath]: z.infer<TData> }>;
	}, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			requirements: {
				...this.#app.requirements,
				topics: {
					...this.#app.requirements.topics,
					[options.path]: options.schema,
				},
			},
		});
	}
}

/**
 * An immutable Baseless server application that holds all registered
 * resources (endpoints, collections, documents, topics, tables) together with
 * pre-compiled path matchers for efficient routing.
 *
 * Prefer creating instances via {@link app} and {@link AppBuilder.build}
 * rather than calling this constructor directly.
 *
 * @template TServerRegistry The full server-side registry.
 * @template TPublicRegistry The public (client-facing) subset.
 */
export class App<TServerRegistry extends AppRegistry = AppRegistry, TPublicRegistry extends PublicAppRegistry = PublicAppRegistry> {
	collections: Record<string, CollectionDefinition> = {};
	decorators: Array<DecorationHandler<AppRegistry, {}>> = [];
	documents: Record<string, DocumentDefinition> = {};
	endpoints: Record<
		string,
		Record<
			string,
			EndpointDefinition<
				AppRegistry,
				string,
				z.ZodRequest,
				z.ZodResponse | z.ZodUnion<z.ZodResponse[]>
			>
		>
	> = {};
	onDocumentDeleting: Array<OnDocumentDeletingDefinition<any, any>> = [];
	onDocumentSetting: Array<OnDocumentSettingDefinition<any, any>> = [];
	onTopicMessage: Array<OnTopicMessageDefinition<any, any>> = [];
	requirements: {
		configuration: Record<string, unknown>;
		context: Record<string, unknown>;
		collections: Record<string, z.ZodType>;
		documents: Record<string, z.ZodType>;
		services: Record<string, unknown>;
		tables: Record<string, z.ZodType>;
		topics: Record<string, z.ZodType>;
	} = {
		configuration: {},
		context: {},
		collections: {},
		documents: {},
		services: {},
		tables: {},
		topics: {},
	};
	services: Array<ServiceHandler<AppRegistry, {}>> = [];
	tables: Record<string, TableDefinition> = {};
	topics: Record<string, TopicDefinition> = {};

	#matchers: {
		collection: Matcher<CollectionDefinition>;
		document: Matcher<DocumentDefinition>;
		endpoint: Matcher<EndpointDefinition<any, any, any, any>>;
		onDocumentDeleting: Matcher<OnDocumentDeletingDefinition<any, any>>;
		onDocumentSetting: Matcher<OnDocumentSettingDefinition<any, any>>;
		onTopicMessage: Matcher<OnTopicMessageDefinition<any, any>>;
		table: Matcher<TableDefinition>;
		topic: Matcher<TopicDefinition>;
	};

	constructor(options: {
		collections: App["collections"];
		decorators: App["decorators"];
		documents: App["documents"];
		endpoints: App["endpoints"];
		onDocumentDeleting: App["onDocumentDeleting"];
		onDocumentSetting: App["onDocumentSetting"];
		onTopicMessage: App["onTopicMessage"];
		requirements: App["requirements"];
		services: App["services"];
		tables: App["tables"];
		topics: App["topics"];
	}) {
		this.collections = options.collections;
		this.decorators = options.decorators;
		this.documents = options.documents;
		this.endpoints = options.endpoints;
		this.onDocumentDeleting = options.onDocumentDeleting;
		this.onDocumentSetting = options.onDocumentSetting;
		this.onTopicMessage = options.onTopicMessage;
		this.requirements = options.requirements;
		this.services = options.services;
		this.tables = options.tables;
		this.topics = options.topics;

		const collectionDefinitions = Object.values(this.collections);
		const topicDefinitions = Object.values(this.topics);
		const documentDefinitions = Object.values(this.documents);
		for (const definition of collectionDefinitions) {
			documentDefinitions.push({
				path: `${definition.path}/:key`,
				schema: definition.schema,
				documentSecurity: "documentSecurity" in definition ? definition.documentSecurity : undefined,
				topicSecurity: "topicSecurity" in definition ? definition.topicSecurity : undefined,
			});
			topicDefinitions.push({
				path: definition.path,
				schema: z.union([
					z.object({ type: z.literal("set"), document: Document(definition.schema) }),
					z.object({ type: z.literal("deleted") }),
				]),
				security: "topicSecurity" in definition ? definition.topicSecurity : undefined,
			});
		}
		for (const definition of documentDefinitions) {
			topicDefinitions.push({
				path: definition.path,
				schema: z.union([
					z.object({ type: z.literal("set"), document: Document(definition.schema) }),
					z.object({ type: z.literal("deleted") }),
				]),
				security: "topicSecurity" in definition ? definition.topicSecurity : undefined,
			});
		}

		const endpoints = Object.entries(this.endpoints)
			.reduce((endpoints, [path, verbs]) => {
				return Object.entries(verbs)
					.reduce((endpoints, [verb, definition]) => {
						return [...endpoints, { ...definition, path: `${path}/#${verb}` }];
					}, endpoints);
			}, [] as EndpointDefinition<any, any, any, any>[]);

		this.#matchers = {
			collection: matchPath(collectionDefinitions),
			document: matchPath(documentDefinitions),
			endpoint: matchPath(endpoints),
			onDocumentDeleting: matchPath(this.onDocumentDeleting),
			onDocumentSetting: matchPath(this.onDocumentSetting),
			onTopicMessage: matchPath(this.onTopicMessage),
			table: matchPath(Object.values(this.tables)),
			topic: matchPath(topicDefinitions),
		};
	}

	/**
	 * Looks up a registered definition by `type` and `path`, returning the
	 * matched definition together with any extracted path parameters.
	 * @param type The resource type to match (e.g. `"collection"`, `"document"`, `"endpoint"`).
	 * @param path The request path to match against registered patterns.
	 */
	match(type: "collection", path: string): ReturnType<Matcher<CollectionDefinition>>;
	match(type: "document", path: string): ReturnType<Matcher<DocumentDefinition>>;
	match(type: "endpoint", path: string): ReturnType<Matcher<EndpointDefinition<any, any, any, any>>>;
	match(type: "onDocumentDeleting", path: string): ReturnType<Matcher<OnDocumentDeletingDefinition<any, any>>>;
	match(type: "onDocumentSetting", path: string): ReturnType<Matcher<OnDocumentSettingDefinition<any, any>>>;
	match(type: "onTopicMessage", path: string): ReturnType<Matcher<OnTopicMessageDefinition<any, any>>>;
	match(type: "table", path: string): ReturnType<Matcher<TableDefinition>>;
	match(type: "topic", path: string): ReturnType<Matcher<TopicDefinition>>;
	match(type: string, path: string): ReturnType<Matcher<any>> {
		const matcher = this.#matchers[type as never] as Matcher<any>;
		return matcher(path);
	}
}

/**
 * Creates a new {@link AppBuilder} with an empty registry. Call builder
 * methods to register collections, documents, endpoints, topics, and then
 * call `.build()` to obtain the {@link App}.
 *
 * @returns A fresh {@link AppBuilder}.
 *
 * @example
 * ```ts
 * import { app } from "@baseless/server";
 *
 * const myApp = app().endpoint({ ... }).build();
 * ```
 */
export function app(): AppBuilder<AppRegistry, PublicAppRegistry> {
	return new AppBuilder<AppRegistry, PublicAppRegistry>({
		collections: {},
		decorators: [],
		documents: {},
		endpoints: {},
		onDocumentDeleting: [],
		onDocumentSetting: [],
		onTopicMessage: [],
		requirements: {
			configuration: {},
			context: {},
			collections: {},
			documents: {},
			services: {},
			tables: {},
			topics: {},
		},
		services: [],
		tables: {},
		topics: {},
	});
}
