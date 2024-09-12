// deno-lint-ignore-file no-explicit-any ban-types
import type { TSchema } from "@sinclair/typebox";
import type {
	CollectionDefinition,
	CollectionDefinitionSecurity,
	CollectionDefinitionWithoutSecurity,
	CollectionDefinitionWithSecurity,
	Context,
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
	Path,
	PickAtPath,
	RpcDefinition,
	RpcDefinitionHandler,
	RpcDefinitionSecurity,
	RpcDefinitionWithoutSecurity,
	RpcDefinitionWithSecurity,
} from "./types.ts";
import { Application } from "./application.ts";

export class ApplicationBuilder<
	TDecoration extends {} = {},
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
	#documentSavingListeners: Array<DocumentAtomicSetListener<any, any>>;
	#documentSavedListeners: Array<DocumentSetListener<any, any>>;
	#documentDeletingListeners: Array<DocumentAtomicDeleteListener<any, any>>;
	#documentDeletedListeners: Array<DocumentDeleteListener<any, any>>;

	constructor();
	constructor(
		contextConstructors: Array<Decorator<any>>,
		rpc: Array<RpcDefinition<any, any, any>>,
		event: Array<EventDefinition<any, any>>,
		document: Array<DocumentDefinition<any, any>>,
		collection: Array<CollectionDefinition<any, any>>,
		eventListeners: Array<EventListener<any, any>>,
		documentSavingListeners: Array<DocumentAtomicSetListener<any, any>>,
		documentSavedListeners: Array<DocumentSetListener<any, any>>,
		documentDeletingListeners: Array<DocumentAtomicDeleteListener<any, any>>,
		documentDeletedListeners: Array<DocumentDeleteListener<any, any>>,
	);
	constructor(
		context?: Array<Decorator<any>>,
		rpc?: Array<RpcDefinition<any, any, any>>,
		event?: Array<EventDefinition<any, any>>,
		document?: Array<DocumentDefinition<any, any>>,
		collection?: Array<CollectionDefinition<any, any>>,
		eventListeners?: Array<EventListener<any, any>>,
		documentSavingListeners?: Array<DocumentAtomicSetListener<any, any>>,
		documentSavedListeners?: Array<DocumentSetListener<any, any>>,
		documentDeletingListeners?: Array<DocumentAtomicDeleteListener<any, any>>,
		documentDeletedListeners?: Array<DocumentDeleteListener<any, any>>,
	) {
		this.#decorator = [...context ?? []];
		this.#rpc = [...rpc ?? []];
		this.#event = [...event ?? []];
		this.#document = [...document ?? []];
		this.#collection = [...collection ?? []];
		this.#eventListeners = [...eventListeners ?? []];
		this.#documentSavingListeners = [
			...documentSavingListeners ?? [],
		];
		this.#documentSavedListeners = [...documentSavedListeners ?? []];
		this.#documentDeletingListeners = [
			...documentDeletingListeners ?? [],
		];
		this.#documentDeletedListeners = [...documentDeletedListeners ?? []];
	}

	build(): Application {
		return new Application(
			[...this.#decorator],
			[...this.#rpc],
			[...this.#event],
			[...this.#document],
			[...this.#collection],
			[...this.#eventListeners],
			[...this.#documentSavingListeners],
			[...this.#documentSavedListeners],
			[...this.#documentDeletingListeners],
			[...this.#documentDeletedListeners],
		);
	}

	decorate<const TNewContext extends {}>(
		decorator: (context: Context<TDecoration, TDocument, TCollection>) => Promise<TNewContext>,
	): ApplicationBuilder<
		TDecoration & TNewContext,
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
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
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
				TDocument,
				TCollection,
				TInputSchema,
				TOutputSchema
			>;
			security: RpcDefinitionSecurity<
				TPath,
				TDecoration,
				TDocument,
				TCollection,
				TInputSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
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
				TDocument,
				TCollection,
				TInputSchema,
				TOutputSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
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
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	emits<const TPath extends Path, const TPayloadSchema extends TSchema>(
		path: TPath,
		options: {
			payload: TPayloadSchema;
			security: EventDefinitionSecurity<
				TPath,
				TDecoration,
				TDocument,
				TCollection,
				TPayloadSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent | [EventDefinitionWithSecurity<TPath, TPayloadSchema>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	emits<const TPath extends Path, const TPayloadSchema extends TSchema>(
		path: TPath,
		options: {
			payload: TPayloadSchema;
		},
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent | [EventDefinitionWithoutSecurity<TPath, TPayloadSchema>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	emits(path: any, options: any): any {
		return new ApplicationBuilder(
			this.#decorator,
			this.#rpc,
			[...this.#event, { path, ...options }],
			this.#document,
			this.#collection,
			this.#eventListeners,
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
				TDocument,
				TCollection,
				TDocumentSchema
			>;
		},
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent,
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
		TRpc,
		TEvent,
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
			this.#event,
			[...this.#document, { path, ...options }],
			this.#collection,
			this.#eventListeners,
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
			security: CollectionDefinitionSecurity<TPath, TDecoration, TDocument, TCollection>;
		},
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent,
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
		TRpc,
		TEvent,
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
			this.#event,
			this.#document,
			[...this.#collection, { path, ...options }],
			this.#eventListeners,
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
			TDocument,
			TCollection,
			TEventDefinition["payload"]
		>,
	): ApplicationBuilder<
		TDecoration,
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
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
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
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
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
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
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
			this.#documentSavingListeners,
			[...this.#documentSavedListeners, { path, handler }],
			this.#documentDeletingListeners,
			this.#documentDeletedListeners,
		);
	}

	onDocumentDeleting<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentAtomicDeleteListenerHandler<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
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
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			[...this.#documentDeletingListeners, { path, handler }],
			this.#documentDeletedListeners,
		);
	}

	onDocumentDeleted<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentDeleteListenerHandler<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>,
	): ApplicationBuilder<
		TDecoration,
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
			this.#documentSavingListeners,
			this.#documentSavedListeners,
			this.#documentDeletingListeners,
			[...this.#documentDeletedListeners, { path, handler }],
		);
	}

	use<
		TOtherDecoration extends Record<string, unknown>,
		TOtherRpc extends Array<RpcDefinition<any, any, any>>,
		TOtherEvent extends Array<EventDefinition<any, any>>,
		TOtherDocument extends Array<DocumentDefinition<any, any>>,
		TOtherCollection extends Array<CollectionDefinition<any, any>>,
		TOtherFile extends Array<unknown>,
		TOtherFolder extends Array<unknown>,
	>(
		application: ApplicationBuilder<
			TOtherDecoration,
			TOtherRpc,
			TOtherEvent,
			TOtherDocument,
			TOtherCollection,
			TOtherFile,
			TOtherFolder
		>,
	): ApplicationBuilder<
		TDecoration & TOtherDecoration,
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
