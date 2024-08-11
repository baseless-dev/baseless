// deno-lint-ignore-file no-explicit-any ban-types
import type { Static, TSchema } from "@sinclair/typebox";
import type {
	CollectionDefinition,
	CollectionDefinitionWithoutSecurity,
	CollectionDefinitionWithSecurity,
	Context,
	Decorator,
	DocumentAtomicListener,
	DocumentDefinition,
	DocumentDefinitionWithoutSecurity,
	DocumentDefinitionWithSecurity,
	DocumentListener,
	EventDefinition,
	EventDefinitionWithoutSecurity,
	EventDefinitionWithSecurity,
	EventListener,
	IdentityListener,
	Path,
	PickAtPath,
	RpcDefinition,
	RpcDefinitionWithoutSecurity,
	RpcDefinitionWithSecurity,
} from "./types.ts";
import { Application } from "./application.ts";
import { PathAsType, ReplaceVariableInPathSegment } from "@baseless/core/path";
import { Document } from "@baseless/core/document";

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
	#documentSavingListeners: Array<DocumentAtomicListener<any, any>>;
	#documentSavedListeners: Array<DocumentListener<any, any>>;
	#documentDeletingListeners: Array<DocumentAtomicListener<any, any>>;
	#documentDeletedListeners: Array<DocumentListener<any, any>>;
	#identityCreatedListeners: Array<IdentityListener>;
	#identityUpdatedListeners: Array<IdentityListener>;
	#identityDeletedListeners: Array<IdentityListener>;

	constructor();
	constructor(
		contextConstructors: Array<Decorator<any>>,
		rpc: Array<RpcDefinition<any, any, any>>,
		event: Array<EventDefinition<any, any>>,
		document: Array<DocumentDefinition<any, any>>,
		collection: Array<CollectionDefinition<any, any>>,
		eventListeners: Array<EventListener<any, any>>,
		documentSavingListeners: Array<DocumentAtomicListener<any, any>>,
		documentSavedListeners: Array<DocumentListener<any, any>>,
		documentDeletingListeners: Array<DocumentAtomicListener<any, any>>,
		documentDeletedListeners: Array<DocumentListener<any, any>>,
		identityCreatedListeners: Array<IdentityListener>,
		identityUpdatedListeners: Array<IdentityListener>,
		identityDeletedListeners: Array<IdentityListener>,
	);
	constructor(
		context?: Array<Decorator<any>>,
		rpc?: Array<RpcDefinition<any, any, any>>,
		event?: Array<EventDefinition<any, any>>,
		document?: Array<DocumentDefinition<any, any>>,
		collection?: Array<CollectionDefinition<any, any>>,
		eventListeners?: Array<EventListener<any, any>>,
		documentSavingListeners?: Array<DocumentAtomicListener<any, any>>,
		documentSavedListeners?: Array<DocumentListener<any, any>>,
		documentDeletingListeners?: Array<DocumentAtomicListener<any, any>>,
		documentDeletedListeners?: Array<DocumentListener<any, any>>,
		identityCreatedListeners?: Array<IdentityListener>,
		identityUpdatedListeners?: Array<IdentityListener>,
		identityDeletedListeners?: Array<IdentityListener>,
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
		this.#identityCreatedListeners = [...identityCreatedListeners ?? []];
		this.#identityUpdatedListeners = [...identityUpdatedListeners ?? []];
		this.#identityDeletedListeners = [...identityDeletedListeners ?? []];
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
			[...this.#identityCreatedListeners],
			[...this.#identityUpdatedListeners],
			[...this.#identityDeletedListeners],
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
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
			handler: (options: {
				context: Context<TDecoration, TDocument, TCollection>;
				params: PathAsType<TPath>;
				input: Static<TInputSchema>;
			}) => Promise<Static<TOutputSchema>>;
			security: (options: {
				context: Context<TDecoration, TDocument, TCollection>;
				params: PathAsType<TPath>;
				input: Static<TInputSchema>;
			}) => Promise<"allow" | "deny" | undefined>;
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
			handler: (options: {
				context: Context<TDecoration, TDocument, TCollection>;
				params: PathAsType<TPath>;
				input: Static<TInputSchema>;
			}) => Promise<Static<TOutputSchema>>;
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	emits<const TPath extends Path, const TPayloadSchema extends TSchema>(
		path: TPath,
		options: {
			payload: TPayloadSchema;
			security: (options: {
				context: Context<TDecoration, TDocument, TCollection>;
				params: PathAsType<TPath>;
				payload: Static<TPayloadSchema>;
			}) => Promise<"subscribe" | "publish" | undefined>;
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	document<const TPath extends Path, const TDocumentSchema extends TSchema>(
		path: TPath,
		options: {
			schema: TDocumentSchema;
			security: (options: {
				context: Context<any, [], []>;
				params: PathAsType<TPath>;
				document: Document<Static<TDocumentSchema>> | null;
			}) => Promise<"subscribe" | "get" | "set" | "delete" | undefined>;
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	collection<const TPath extends Path, const TCollectionSchema extends TSchema>(
		path: TPath,
		options: {
			schema: TCollectionSchema;
			security: (options: {
				context: Context<any, [], []>;
				params: PathAsType<TPath>;
				key: ReplaceVariableInPathSegment<TPath>;
			}) => Promise<"list" | undefined>;
		},
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent,
		TDocument | [
			DocumentDefinitionWithoutSecurity<[...TPath, string], TCollectionSchema>,
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
			DocumentDefinitionWithoutSecurity<[...TPath, string], TCollectionSchema>,
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onEvent<
		const TPath extends TEvent[number]["matcher"],
		const TEventDefinition extends PickAtPath<TEvent, TPath>,
	>(
		path: TPath,
		handler: EventListener<TPath, TEventDefinition["payload"]>["handler"],
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentSaving<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentAtomicListener<TPath, TDocumentDefinition["schema"]>["handler"],
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentSaved<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentListener<TPath, TDocumentDefinition["schema"]>["handler"],
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
		handler: DocumentListener<TPath, TDocumentDefinition["schema"]>["handler"],
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentDeleting<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentAtomicListener<TPath, TDocumentDefinition["schema"]>["handler"],
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onDocumentDeleted<
		const TPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TPath>,
	>(
		path: TPath,
		handler: DocumentListener<TPath, TDocumentDefinition["schema"]>["handler"],
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
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onIdentityCreated(
		handler: IdentityListener["handler"],
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
			this.#documentDeletedListeners,
			[...this.#identityCreatedListeners, { handler }],
			this.#identityUpdatedListeners,
			this.#identityDeletedListeners,
		);
	}

	onIdentityUpdated(
		handler: IdentityListener["handler"],
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
			this.#documentDeletedListeners,
			this.#identityCreatedListeners,
			[...this.#identityUpdatedListeners, { handler }],
			this.#identityDeletedListeners,
		);
	}

	onIdentityDeleted(
		handler: IdentityListener["handler"],
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
			this.#documentDeletedListeners,
			this.#identityCreatedListeners,
			this.#identityUpdatedListeners,
			[...this.#identityDeletedListeners, { handler }],
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
		TDecoration | TOtherDecoration,
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
			[...this.#identityCreatedListeners, ...application.#identityCreatedListeners],
			[...this.#identityUpdatedListeners, ...application.#identityUpdatedListeners],
			[...this.#identityDeletedListeners, ...application.#identityDeletedListeners],
		);
	}

	// folder(path, { mimetypes, extensions, security? })
	// file(path, { mimetypes, extensions, security? })
	// room(path, { security? })
}
