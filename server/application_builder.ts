// deno-lint-ignore-file no-explicit-any ban-types
import type { TSchema } from "@sinclair/typebox";
import type {
	CollectionDefinition,
	CollectionDefinitionSecurity,
	CollectionDefinitionWithoutSecurity,
	CollectionDefinitionWithSecurity,
	Decorator,
	DocumentAtomicDeleteListener,
	DocumentAtomicDeleteListenerHandler,
	DocumentAtomicSetListener,
	DocumentAtomicSetListenerHandler,
	DocumentDefinition,
	DocumentDefinitionSecurity,
	DocumentDefinitionWithoutSecurity,
	DocumentDefinitionWithSecurity,
	DocumentDeleteListener,
	DocumentDeleteListenerHandler,
	DocumentSetListener,
	DocumentSetListenerHandler,
	EventDefinition,
	EventDefinitionSecurity,
	EventDefinitionWithoutSecurity,
	EventDefinitionWithSecurity,
	EventListener,
	EventListenerHandler,
	HubListener,
	HubListenerHandler,
	Path,
	PickAtPath,
	RpcDefinition,
	RpcDefinitionHandler,
	RpcDefinitionSecurity,
	RpcDefinitionWithoutSecurity,
	RpcDefinitionWithSecurity,
	TypedContext,
} from "./types.ts";
import { Application } from "./application.ts";
import { DocumentChange, TDocumentChange } from "@baseless/core/document";

export class ApplicationBuilder<
	TDecoration extends {} = {},
	TDependencies extends {} = {},
	TRpc extends Array<RpcDefinition<any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> {
	#decorator: Array<Decorator<any>>;
	#rpc: Array<RpcDefinition<any, any, any>>;
	#event: Array<EventDefinition<any, any>>;
	#document: Array<DocumentDefinition<any, any>>;
	#collection: Array<CollectionDefinition<any, any>>;
	#eventListeners: Array<EventListener<any, any>>;
	#hubConnectedListeners: Array<HubListener>;
	#hubDisconnectedListeners: Array<HubListener>;
	#documentSavingListeners: Array<DocumentAtomicSetListener<any, any>>;
	#documentSavedListeners: Array<DocumentSetListener<any, any>>;
	#documentDeletingListeners: Array<DocumentAtomicDeleteListener<any, any>>;
	#documentDeletedListeners: Array<DocumentDeleteListener<any>>;

	constructor();
	constructor(
		contextConstructors: Array<Decorator<any>>,
		rpc: Array<RpcDefinition<any, any, any>>,
		event: Array<EventDefinition<any, any>>,
		document: Array<DocumentDefinition<any, any>>,
		collection: Array<CollectionDefinition<any, any>>,
		eventListeners: Array<EventListener<any, any>>,
		hubConnectedListeners: Array<HubListener>,
		hubDisconnectedListeners: Array<HubListener>,
		documentSavingListeners: Array<DocumentAtomicSetListener<any, any>>,
		documentSavedListeners: Array<DocumentSetListener<any, any>>,
		documentDeletingListeners: Array<DocumentAtomicDeleteListener<any, any>>,
		documentDeletedListeners: Array<DocumentDeleteListener<any>>,
	);
	constructor(
		context?: Array<Decorator<any>>,
		rpc?: Array<RpcDefinition<any, any, any>>,
		event?: Array<EventDefinition<any, any>>,
		document?: Array<DocumentDefinition<any, any>>,
		collection?: Array<CollectionDefinition<any, any>>,
		eventListeners?: Array<EventListener<any, any>>,
		hubConnectedListeners?: Array<HubListener>,
		hubDisconnectedListeners?: Array<HubListener>,
		documentSavingListeners?: Array<DocumentAtomicSetListener<any, any>>,
		documentSavedListeners?: Array<DocumentSetListener<any, any>>,
		documentDeletingListeners?: Array<DocumentAtomicDeleteListener<any, any>>,
		documentDeletedListeners?: Array<DocumentDeleteListener<any>>,
	) {
		this.#decorator = [...context ?? []];
		this.#rpc = [...rpc ?? []];
		this.#event = [...event ?? []];
		this.#document = [...document ?? []];
		this.#collection = [...collection ?? []];
		this.#eventListeners = [...eventListeners ?? []];
		this.#hubConnectedListeners = [...hubConnectedListeners ?? []];
		this.#hubDisconnectedListeners = [...hubDisconnectedListeners ?? []];
		this.#documentSavingListeners = [
			...documentSavingListeners ?? [],
		];
		this.#documentSavedListeners = [...documentSavedListeners ?? []];
		this.#documentDeletingListeners = [
			...documentDeletingListeners ?? [],
		];
		this.#documentDeletedListeners = [...documentDeletedListeners ?? []];
	}

	build(): Application<TDependencies> {
		return new Application(
			[...this.#decorator],
			[...this.#rpc],
			[...this.#event],
			[...this.#document],
			[...this.#collection],
			[...this.#eventListeners],
			[...this.#hubConnectedListeners],
			[...this.#hubDisconnectedListeners],
			[...this.#documentSavingListeners],
			[...this.#documentSavedListeners],
			[...this.#documentDeletingListeners],
			[...this.#documentDeletedListeners],
		);
	}

	decorate<const TNewContext extends {}>(
		decorator: (context: TypedContext<TDecoration, TEvent, TDocument, TCollection>) => Promise<TNewContext>,
	): ApplicationBuilder<
		TDecoration & TNewContext,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new ApplicationBuilder(
			[...this.#decorator, decorator],
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	depends<const TNewDependency extends {}>(): ApplicationBuilder<
		TDecoration & TNewDependency,
		TDependencies & TNewDependency,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return this as never;
	}

	rpc<
		const TPath extends Path,
		const TInputSchema extends TSchema,
		const TOutputSchema extends TSchema,
	>(
		path: TPath,
		options: {
			input: TInputSchema;
			output: TOutputSchema;
			handler: RpcDefinitionHandler<
				TPath,
				TDecoration,
				TEvent,
				TDocument,
				TCollection,
				TInputSchema,
				TOutputSchema
			>;
			security: RpcDefinitionSecurity<
				TPath,
				TDecoration,
				TEvent,
				TDocument,
				TCollection,
				TInputSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc | [RpcDefinitionWithSecurity<TPath, TInputSchema, TOutputSchema>],
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	rpc<
		const TPath extends Path,
		const TInputSchema extends TSchema,
		const TOutputSchema extends TSchema,
	>(
		path: TPath,
		options: {
			input: TInputSchema;
			output: TOutputSchema;
			handler: RpcDefinitionHandler<
				TPath,
				TDecoration,
				TEvent,
				TDocument,
				TCollection,
				TInputSchema,
				TOutputSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc | [RpcDefinitionWithoutSecurity<TPath, TInputSchema, TOutputSchema>],
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	rpc(path: any, options: any): any {
		return new ApplicationBuilder(
			this.#decorator,
			[...this.#rpc, { path, ...options }],
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	event<const TPath extends Path, const TPayloadSchema extends TSchema>(
		path: TPath,
		options: {
			payload: TPayloadSchema;
			security: EventDefinitionSecurity<
				TPath,
				TDecoration,
				TEvent | [EventDefinitionWithoutSecurity<TPath, TPayloadSchema>],
				TDocument,
				TCollection,
				TPayloadSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent | [EventDefinitionWithSecurity<TPath, TPayloadSchema>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	event<const TPath extends Path, const TPayloadSchema extends TSchema>(
		path: TPath,
		options: {
			payload: TPayloadSchema;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent | [EventDefinitionWithoutSecurity<TPath, TPayloadSchema>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	event(path: any, options: any): any {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			[...this.#event, { path, ...options }],
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	document<const TPath extends Path, const TDocumentSchema extends TSchema>(
		path: TPath,
		options: {
			schema: TDocumentSchema;
			security: DocumentDefinitionSecurity<
				TPath,
				TDecoration,
				TEvent,
				TDocument | [DocumentDefinitionWithSecurity<TPath, TDocumentSchema>],
				TCollection,
				TDocumentSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent | [EventDefinitionWithSecurity<["$document", ...TPath], TDocumentChange<TDocumentSchema>>],
		TDocument | [DocumentDefinitionWithSecurity<TPath, TDocumentSchema>],
		TCollection,
		TFile,
		TFolder
	>;
	document<const TPath extends Path, const TDocumentSchema extends TSchema>(
		path: TPath,
		options: {
			schema: TDocumentSchema;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent | [EventDefinitionWithoutSecurity<["$document", ...TPath], TDocumentChange<TDocumentSchema>>],
		TDocument | [
			DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema>,
		],
		TCollection,
		TFile,
		TFolder
	>;
	document(path: any, options: any): any {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			[
				...this.#event,
				{ path: ["$document", ...path], payload: DocumentChange(options.schema), security: options.security } as never,
			],
			[...this.#document, { path, ...options }],
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	collection<const TPath extends Path, const TCollectionSchema extends TSchema>(
		path: TPath,
		options: {
			schema: TCollectionSchema;
			security: CollectionDefinitionSecurity<
				TPath,
				TDecoration,
				TEvent,
				TDocument | [
					DocumentDefinitionWithSecurity<[...TPath, "{docId}"], TCollectionSchema>,
				],
				TCollection | [
					CollectionDefinitionWithSecurity<TPath, TCollectionSchema>,
				],
				TCollectionSchema
			>;
			securityDocument: DocumentDefinitionSecurity<
				[...TPath, "{docId}"],
				TDecoration,
				TEvent,
				TDocument | [
					DocumentDefinitionWithSecurity<[...TPath, "{docId}"], TCollectionSchema>,
				],
				TCollection | [
					CollectionDefinitionWithSecurity<TPath, TCollectionSchema>,
				],
				TCollectionSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent | [EventDefinitionWithSecurity<["$document", ...TPath, "{docId}"], TDocumentChange<TCollectionSchema>>] | [
			EventDefinitionWithSecurity<["$collection", ...TPath], TDocumentChange<TCollectionSchema>>,
		],
		TDocument | [
			DocumentDefinitionWithSecurity<[...TPath, "{docId}"], TCollectionSchema>,
		],
		TCollection | [
			CollectionDefinitionWithSecurity<TPath, TCollectionSchema>,
		],
		TFile,
		TFolder
	>;
	collection<const TPath extends Path, const TCollectionSchema extends TSchema>(
		path: TPath,
		options: {
			schema: TCollectionSchema;
		},
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent | [EventDefinitionWithoutSecurity<["$document", ...TPath, "{docId}"], TDocumentChange<TCollectionSchema>>] | [
			EventDefinitionWithoutSecurity<["$collection", ...TPath], TDocumentChange<TCollectionSchema>>,
		],
		TDocument | [
			DocumentDefinitionWithoutSecurity<[...TPath, "{docId}"], TCollectionSchema>,
		],
		TCollection | [
			CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema>,
		],
		TFile,
		TFolder
	>;
	collection(path: any, options: any): any {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			[
				...this.#event,
				{ path: ["$document", ...path, "{docId}"], payload: DocumentChange(options.schema), security: options.security } as never,
				{ path: ["$collection", ...path], payload: DocumentChange(options.schema), security: options.security } as never,
			],
			this.#document,
			[...this.#collection, { path, ...options }],
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	onEvent<
		const TPath extends TEvent[number]["matcher"],
		const TEventDefinition extends PickAtPath<TEvent, TPath>,
	>(
		path: TPath,
		handler: EventListenerHandler<
			TPath,
			TDecoration,
			TEvent,
			TDocument,
			TCollection,
			TEventDefinition["payload"]
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			[...this.#eventListeners, { path, handler }],
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	onHubConnect(
		handler: HubListenerHandler<
			TDecoration,
			TEvent,
			TDocument,
			TCollection
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			[...this.#hubConnectedListeners, { handler }],
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	onHubDisconnect(
		handler: HubListenerHandler<
			TDecoration,
			TEvent,
			TDocument,
			TCollection
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			[...this.#hubDisconnectedListeners, { handler }],
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	onDocumentSaving<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentAtomicSetListenerHandler<
			TPath,
			TDecoration,
			TEvent,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			[...this.#documentSavingListeners, { path, handler }],
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	onDocumentSaved<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentSetListenerHandler<
			TPath,
			TDecoration,
			TEvent,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	onDocumentSaved<
		const TPath extends TCollection[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TCollection, TPath>,
	>(
		path: TPath,
		handler: DocumentSetListenerHandler<
			TPath,
			TDecoration,
			TEvent,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	onDocumentSaved(path: any, handler: any): any {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			[...this.#documentSavedListeners, { path, handler }],
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	onDocumentDeleting<
		const TPath extends TDocument[number]["matcher"],
	>(
		path: TPath,
		handler: DocumentAtomicDeleteListenerHandler<
			TPath,
			TDecoration,
			TEvent,
			TDocument,
			TCollection
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			[...this.#documentDeletingListeners, { path, handler }],
			this.#documentDeletedListeners,
		);
	}

	onDocumentDeleted<
		const TPath extends TDocument[number]["matcher"],
	>(
		path: TPath,
		handler: DocumentDeleteListenerHandler<
			TPath,
			TDecoration,
			TEvent,
			TDocument,
			TCollection
		>,
	): ApplicationBuilder<
		TDecoration,
		TDependencies,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			this.#event,
			this.#document,
			this.#collection,
			this.#eventListeners,
			this.#hubConnectedListeners,
			this.#hubDisconnectedListeners,
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			[...this.#documentDeletedListeners, { path, handler }],
		);
	}

	use<
		TOtherDecoration extends {},
		TOtherDependencies extends {},
		TOtherRpc extends Array<RpcDefinition<any, any, any>>,
		TOtherEvent extends Array<EventDefinition<any, any>>,
		TOtherDocument extends Array<DocumentDefinition<any, any>>,
		TOtherCollection extends Array<CollectionDefinition<any, any>>,
		TOtherFile extends Array<unknown>,
		TOtherFolder extends Array<unknown>,
	>(
		application: ApplicationBuilder<
			TOtherDecoration,
			TOtherDependencies,
			TOtherRpc,
			TOtherEvent,
			TOtherDocument,
			TOtherCollection,
			TOtherFile,
			TOtherFolder
		>,
	): ApplicationBuilder<
		TDecoration & TOtherDecoration,
		TDependencies & TOtherDependencies,
		[...TRpc, ...TOtherRpc],
		[...TEvent, ...TOtherEvent],
		[...TDocument, ...TOtherDocument],
		[...TCollection, ...TOtherCollection],
		[...TFile, ...TOtherFile],
		[...TFolder, ...TOtherFolder]
	> {
		return new ApplicationBuilder(
			[...this.#decorator, ...application.#decorator],
			[...this.#rpc, ...application.#rpc],
			[...this.#event, ...application.#event],
			[...this.#document, ...application.#document],
			[...this.#collection, ...application.#collection],
			[...this.#eventListeners, ...application.#eventListeners],
			[...this.#hubConnectedListeners, ...application.#hubConnectedListeners],
			[...this.#hubDisconnectedListeners, ...application.#hubDisconnectedListeners],
			[
				...this.#documentSavingListeners,
				...application.#documentSavingListeners,
			],
			[...this.#documentSavedListeners, ...application.#documentSavedListeners],
			[
				...this.#documentDeletingListeners,
				...application.#documentDeletingListeners,
			],
			[...this.#documentDeletedListeners, ...application.#documentDeletedListeners],
		);
	}

	// folder(path, { mimetypes, extensions, security? })
	// file(path, { mimetypes, extensions, security? })
	// room(path, { security? })

	inspect(): {
		rpc: Array<RpcDefinition<any, any, any>>;
		event: Array<EventDefinition<any, any>>;
		document: Array<DocumentDefinition<any, any>>;
		collection: Array<CollectionDefinition<any, any>>;
	} {
		return {
			rpc: this.#rpc,
			event: this.#event,
			document: this.#document,
			collection: this.#collection,
		};
	}
}
