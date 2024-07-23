// deno-lint-ignore-file no-explicit-any ban-types
import { type Static, type TSchema } from "@sinclair/typebox";
import { type Identity } from "../core/identity.ts";

export type Path = Array<string>;

export type ContextConstructor<Context, NewContext> = (
	options: { request: Request; context: Context },
) => Promise<NewContext>;

export interface RpcDefinitionWithoutSecurity<
	Path,
	Context,
	Input extends TSchema,
	Output extends TSchema,
> {
	path: Path;
	input: Input;
	output: Output;
	handler: (options: {
		context: Context;
		input: Static<Input>;
	}) => Promise<Static<Output>>;
}

export interface RpcDefinitionWithSecurity<
	Path,
	Context,
	Input extends TSchema,
	Output extends TSchema,
> extends RpcDefinitionWithoutSecurity<Path, Context, Input, Output> {
	security: (context: Context) => "allow" | "deny" | undefined;
}

export type RpcDefinition<
	Path,
	Context,
	Input extends TSchema,
	Output extends TSchema,
> =
	| RpcDefinitionWithoutSecurity<Path, Context, Input, Output>
	| RpcDefinitionWithSecurity<Path, Context, Input, Output>;

export interface EventDefinitionWithoutSecurity<
	Path,
	Context,
	Payload extends TSchema,
> {
	path: Path;
	payload: Payload;
}

export interface EventDefinitionWithSecurity<
	Path,
	Context,
	Payload extends TSchema,
> extends EventDefinitionWithoutSecurity<Path, Context, Payload> {
	security: (context: Context) => "subscribe" | "publish" | undefined;
}

export type EventDefinition<Path, Context, Payload extends TSchema> =
	| EventDefinitionWithoutSecurity<Path, Context, Payload>
	| EventDefinitionWithSecurity<Path, Context, Payload>;

export interface DocumentDefinitionWithoutSecurity<
	Path,
	Context,
	Schema extends TSchema,
> {
	path: Path;
	schema: Schema;
}

export interface DocumentDefinitionWithSecurity<
	Path,
	Context,
	Schema extends TSchema,
> extends DocumentDefinitionWithoutSecurity<Path, Context, Schema> {
	security: (
		context: Context,
	) => "subscribe" | "read" | "update" | "delete" | undefined;
}

export type DocumentDefinition<Path, Context, Schema extends TSchema> =
	| DocumentDefinitionWithoutSecurity<Path, Context, Schema>
	| DocumentDefinitionWithSecurity<Path, Context, Schema>;

export interface CollectionDefinitionWithoutSecurity<
	Path,
	Context,
	Schema extends TSchema,
> {
	path: Path;
	schema: Schema;
}

export interface CollectionDefinitionWithSecurity<
	Path,
	Context,
	Schema extends TSchema,
> extends CollectionDefinitionWithoutSecurity<Path, Context, Schema> {
	security: (
		context: Context,
	) =>
		| "subscribe"
		| "list"
		| "create"
		| "read"
		| "update"
		| "delete"
		| undefined;
}

export type CollectionDefinition<Path, Context, Schema extends TSchema> =
	| CollectionDefinitionWithoutSecurity<Path, Context, Schema>
	| CollectionDefinitionWithSecurity<Path, Context, Schema>;

export interface EventListener<Path, Context, Payload extends TSchema> {
	path: Path;
	handler: (options: {
		context: Context;
		payload: Static<Payload>;
	}) => Promise<void>;
}

export interface DocumentAtomicListener<Path, Context, Schema extends TSchema> {
	path: Path;
	handler: (options: {
		context: Context;
		document: Static<Schema>;
		atomic: unknown;
	}) => Promise<void>;
}

export interface DocumentListener<Path, Context, Schema extends TSchema> {
	path: Path;
	handler: (options: {
		context: Context;
		document: Static<Schema>;
	}) => Promise<void>;
}

export interface IdentityListener<Context> {
	handler: (
		options: { context: Context; identity: Identity },
	) => Promise<void>;
}

// deno-fmt-ignore
export type PickAtPath<TEvent extends Array<{ path: any }>, Path> = {
	[K in keyof TEvent]: TEvent[K]["path"] extends Path ? TEvent[K] : never
}[number];

export class Application<
	TContext extends {} = {},
	TRpc extends Array<RpcDefinition<any, any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> {
	#context: Array<ContextConstructor<any, any>>;
	#rpc: Array<RpcDefinition<any, any, any, any>>;
	#event: Array<EventDefinition<any, any, any>>;
	#document: Array<DocumentDefinition<any, any, any>>;
	#collection: Array<CollectionDefinition<any, any, any>>;
	#eventListeners: Array<EventListener<any, any, any>>;
	#documentAtomicSetListeners: Array<DocumentAtomicListener<any, any, any>>;
	#documentSetListeners: Array<DocumentListener<any, any, any>>;
	#documentAtomicDeleteListeners: Array<
		DocumentAtomicListener<any, any, any>
	>;
	#documentDeleteListeners: Array<DocumentListener<any, any, any>>;
	#identityCreatedListeners: Array<IdentityListener<any>>;
	#identityUpdatedListeners: Array<IdentityListener<any>>;
	#identityDeletedListeners: Array<IdentityListener<any>>;

	constructor();
	constructor(
		contextConstructors: Array<ContextConstructor<any, any>>,
		rpc: Array<RpcDefinition<any, any, any, any>>,
		event: Array<EventDefinition<any, any, any>>,
		document: Array<DocumentDefinition<any, any, any>>,
		collection: Array<CollectionDefinition<any, any, any>>,
		eventListeners: Array<EventListener<any, any, any>>,
		documentAtomicSetListeners: Array<
			DocumentAtomicListener<any, any, any>
		>,
		documentSetListeners: Array<DocumentListener<any, any, any>>,
		documentAtomicDeleteListeners: Array<
			DocumentAtomicListener<any, any, any>
		>,
		documentDeleteListeners: Array<DocumentListener<any, any, any>>,
		identityCreatedListeners: Array<IdentityListener<any>>,
		identityUpdatedListeners: Array<IdentityListener<any>>,
		identityDeletedListeners: Array<IdentityListener<any>>,
	);
	constructor(
		context?: Array<ContextConstructor<any, any>>,
		rpc?: Array<RpcDefinition<any, any, any, any>>,
		event?: Array<EventDefinition<any, any, any>>,
		document?: Array<DocumentDefinition<any, any, any>>,
		collection?: Array<CollectionDefinition<any, any, any>>,
		eventListeners?: Array<EventListener<any, any, any>>,
		documentAtomicSetListeners?: Array<
			DocumentAtomicListener<any, any, any>
		>,
		documentSetListeners?: Array<DocumentListener<any, any, any>>,
		documentAtomicDeleteListeners?: Array<
			DocumentAtomicListener<any, any, any>
		>,
		documentDeleteListeners?: Array<DocumentListener<any, any, any>>,
		identityCreatedListeners?: Array<IdentityListener<any>>,
		identityUpdatedListeners?: Array<IdentityListener<any>>,
		identityDeletedListeners?: Array<IdentityListener<any>>,
	) {
		this.#context = [...context ?? []];
		this.#rpc = [...rpc ?? []];
		this.#event = [...event ?? []];
		this.#document = [...document ?? []];
		this.#collection = [...collection ?? []];
		this.#eventListeners = [...eventListeners ?? []];
		this.#documentAtomicSetListeners = [
			...documentAtomicSetListeners ?? [],
		];
		this.#documentSetListeners = [...documentSetListeners ?? []];
		this.#documentAtomicDeleteListeners = [
			...documentAtomicDeleteListeners ?? [],
		];
		this.#documentDeleteListeners = [...documentDeleteListeners ?? []];
		this.#identityCreatedListeners = [...identityCreatedListeners ?? []];
		this.#identityUpdatedListeners = [...identityUpdatedListeners ?? []];
		this.#identityDeletedListeners = [...identityDeletedListeners ?? []];
	}

	context<const TNewContext extends {}>(
		ctor: ContextConstructor<TContext, TNewContext>,
	): Application<
		TContext & TNewContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			[...this.#context, ctor],
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	rpc<
		const TPath extends Path,
		const TInput extends TSchema,
		const TOutput extends TSchema,
	>(
		path: TPath,
		options: Omit<
			RpcDefinitionWithoutSecurity<TPath, TContext, TInput, TOutput>,
			"path"
		>,
	): Application<
		TContext,
		TRpc | [RpcDefinitionWithoutSecurity<TPath, TContext, TInput, TOutput>],
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	rpc<
		const TPath extends Path,
		const TInput extends TSchema,
		const TOutput extends TSchema,
	>(
		path: TPath,
		options: Omit<
			RpcDefinitionWithSecurity<TPath, TContext, TInput, TOutput>,
			"path"
		>,
	): Application<
		TContext,
		TRpc | [RpcDefinitionWithSecurity<TPath, TContext, TInput, TOutput>],
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	rpc(
		path: any,
		options: any,
	): any {
		return new Application(
			this.#context,
			[...this.#rpc, { path, ...options }],
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	emits<const TPath extends Path, const TPayload extends TSchema>(
		path: TPath,
		options: Omit<
			EventDefinitionWithoutSecurity<TPath, TContext, TPayload>,
			"path"
		>,
	): Application<
		TContext,
		TRpc,
		TEvent | [EventDefinitionWithoutSecurity<TPath, TContext, TPayload>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	emits<const TPath extends Path, const TPayload extends TSchema>(
		path: TPath,
		options: Omit<
			EventDefinitionWithSecurity<TPath, TContext, TPayload>,
			"path"
		>,
	): Application<
		TContext,
		TRpc,
		TEvent | [EventDefinitionWithSecurity<TPath, TContext, TPayload>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	emits(
		path: any,
		options: any,
	): any {
		return new Application(
			this.#context,
			this.#rpc,
			[...this.#event, { path, ...options }],
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	document<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			DocumentDefinitionWithoutSecurity<TPath, TContext, Schema>,
			"path"
		>,
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument | [
			DocumentDefinitionWithoutSecurity<TPath, TContext, Schema>,
		],
		TCollection,
		TFile,
		TFolder
	>;
	document<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			DocumentDefinitionWithSecurity<TPath, TContext, Schema>,
			"path"
		>,
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument | [DocumentDefinitionWithSecurity<TPath, TContext, Schema>],
		TCollection,
		TFile,
		TFolder
	>;
	document(
		path: any,
		options: any,
	): any {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			[...this.#document, { path, ...options }],
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	collection<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			CollectionDefinitionWithoutSecurity<TPath, TContext, Schema>,
			"path"
		>,
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection | [
			CollectionDefinitionWithoutSecurity<TPath, TContext, Schema>,
		],
		TFile,
		TFolder
	>;
	collection<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			CollectionDefinitionWithSecurity<TPath, TContext, Schema>,
			"path"
		>,
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection | [
			CollectionDefinitionWithSecurity<TPath, TContext, Schema>,
		],
		TFile,
		TFolder
	>;
	collection(
		path: any,
		options: any,
	): any {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			[...this.#collection, { path, ...options }],
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onEvent<
		const TPath extends TEvent[number]["path"],
		const TEventDefinition extends PickAtPath<TEvent, TPath>,
	>(
		path: TPath,
		handler: EventListener<
			TPath,
			TContext,
			TEventDefinition["payload"]
		>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			[...this.#eventListeners, { path, handler }],
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentAtomicSet<
		const TPath extends TDocument[number]["path"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentAtomicListener<
			TPath,
			TContext,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			[...this.#documentAtomicSetListeners, { path, handler }],
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentSet<
		const TPath extends TDocument[number]["path"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentListener<
			TPath,
			TContext,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			[...this.#documentSetListeners, { path, handler }],
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentAtomicDelete<
		const TPath extends TDocument[number]["path"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentAtomicListener<
			TPath,
			TContext,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			[...this.#documentAtomicDeleteListeners, { path, handler }],
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentDeleted<
		const TPath extends TDocument[number]["path"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentListener<
			TPath,
			TContext,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			[...this.#documentDeleteListeners, { path, handler }],
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onIdentityCreated(
		handler: IdentityListener<TContext>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			[...this.#identityCreatedListeners, { handler }],
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onIdentityUpdated(
		handler: IdentityListener<TContext>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			[...this.#identityUpdatedListeners, { handler }],
			this.#identityDeletedListeners,
		);
	}

	onIdentityDeleted(
		handler: IdentityListener<TContext>["handler"],
	): Application<
		TContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#context,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#documentAtomicSetListeners,
			this.#documentSetListeners,
			this.#documentAtomicDeleteListeners,
			this.#documentDeleteListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			[...this.#identityDeletedListeners, { handler }],
		);
	}

	// requireContext
	// requireEvent
	// requireCollection
	// requireDocument
	// requireFolder
	// requireFile
	// use
	// folder(path, { mimetypes, extensions, security? })
	// file(path, { mimetypes, extensions, security? })
	// room(path, { security? })
}
