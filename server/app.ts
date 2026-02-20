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

// deno-fmt-ignore
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
export type Permission = number;

export type Auth =
	| {
		identityId: ID<"id_">;
		scope: string[];
	}
	| undefined;

export interface AppRegistry {
	collections: {};
	configuration: {};
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

export interface PublicAppRegistry {
	endpoints: {};
	collections: {};
	documents: {};
	tables: {};
	topics: {};
}

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

export type TopicMessage<TData> = {
	topic: string;
	data: TData;
	stopPropagation: boolean;
	stopImmediatePropagation: boolean;
};

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

export interface ServerCollectionDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
}

export interface PublicCollectionDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
	collectionSecurity: CollectionSecurityHandler<TRegistry, PathToParams<TPath>>;
	documentSecurity: DocumentSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
	topicSecurity: TopicMessageSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
}

export type CollectionDefinition = ServerCollectionDefinition<any, any, any> | PublicCollectionDefinition<any, any, any>;

export interface ServerDocumentDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
}

export interface PublicDocumentDefinition<TRegistry extends AppRegistry, TPath extends string, TData extends z.ZodType> {
	path: TPath;
	schema: TData;
	documentSecurity: DocumentSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
	topicSecurity: TopicMessageSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
}

export type DocumentDefinition = ServerDocumentDefinition<any, any, any> | PublicDocumentDefinition<any, any, any>;

export interface OnDocumentSettingDefinition<
	TRegistry extends AppRegistry,
	TPath extends keyof TRegistry["documents"],
> {
	path: TPath;
	handler: DocumentSettingHandler<TRegistry, PathToParams<TPath>, TRegistry["documents"][TPath]>;
}

export interface OnDocumentDeletingDefinition<
	TRegistry extends AppRegistry,
	TPath extends keyof TRegistry["documents"],
> {
	path: TPath;
	handler: DocumentDeletingHandler<TRegistry, PathToParams<TPath>, TRegistry["documents"][TPath]>;
}

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

export interface ServerTableDefinition<
	TRegistry extends AppRegistry,
	TName extends string,
	TData extends z.ZodObject,
> {
	path: TName;
	schema: TData;
}

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

export type TableDefinition = ServerTableDefinition<any, any, any> | PublicTableDefinition<any, any, any>;

export interface ServerTopicDefinition<
	TRegistry extends AppRegistry,
	TPath extends string,
	TData extends z.ZodType,
> {
	path: TPath;
	schema: TData;
}

export interface PublicTopicDefinition<
	TRegistry extends AppRegistry,
	TPath extends string,
	TData extends z.ZodType,
> {
	path: TPath;
	schema: TData;
	security: TopicMessageSecurityHandler<TRegistry, PathToParams<TPath>, TData>;
}

export type TopicDefinition = ServerTopicDefinition<any, any, any> | PublicTopicDefinition<any, any, any>;

export interface OnTopicMessageDefinition<
	TRegistry extends AppRegistry,
	TPath extends keyof TRegistry["topics"],
> {
	path: TPath;
	handler: TopicMessageHandler<TRegistry, PathToParams<TPath>, TRegistry["topics"][TPath]>;
}

export class AppBuilder<TServerRegistry extends AppRegistry, TPublicRegistry extends PublicAppRegistry> {
	#app: ConstructorParameters<typeof App>[0];

	constructor(app: ConstructorParameters<typeof App>[0]) {
		this.#app = app;
	}

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

	onDocumentSetting<TPath extends keyof TServerRegistry["documents"]>(
		definition: OnDocumentSettingDefinition<TServerRegistry, TPath>,
	): AppBuilder<TServerRegistry, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			onDocumentSetting: [...this.#app.onDocumentSetting, definition as never],
		});
	}

	onDocumentDeleting<TPath extends keyof TServerRegistry["documents"]>(
		definition: OnDocumentDeletingDefinition<TServerRegistry, TPath>,
	): AppBuilder<TServerRegistry, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			onDocumentDeleting: [...this.#app.onDocumentDeleting, definition as never],
		});
	}

	onTopicMessage<TPath extends keyof TServerRegistry["topics"]>(
		definition: OnTopicMessageDefinition<TServerRegistry, TPath>,
	): AppBuilder<TServerRegistry, TPublicRegistry> {
		return new AppBuilder<any, any>({
			...this.#app,
			onTopicMessage: [...this.#app.onTopicMessage, definition as never],
		});
	}

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
