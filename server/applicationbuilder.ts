// deno-lint-ignore-file no-explicit-any ban-types
import type { TSchema } from "@sinclair/typebox";
import type {
	CollectionDefinition,
	CollectionDefinitionWithoutSecurity,
	CollectionDefinitionWithSecurity,
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

export class ApplicationBuilder<
	TDecoration extends {} = {},
	TRpc extends Array<RpcDefinition<any, any, any, any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any, any, any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> {
	#decorator: Array<Decorator<any, any, any, any>>;
	#rpc: Array<RpcDefinition<any, any, any, any, any, any>>;
	#event: Array<EventDefinition<any, any, any, any, any>>;
	#document: Array<DocumentDefinition<any, any, any, any, any>>;
	#collection: Array<CollectionDefinition<any, any, any, any, any>>;
	#eventListeners: Array<EventListener<any, any, any, any, any>>;
	#documentSavingListeners: Array<DocumentAtomicListener<any, any, any, any, any>>;
	#documentSavedListeners: Array<DocumentListener<any, any, any, any, any>>;
	#documentDeletingListeners: Array<
		DocumentAtomicListener<any, any, any, any, any>
	>;
	#documentDeletedListeners: Array<DocumentListener<any, any, any, any, any>>;
	#identityCreatedListeners: Array<IdentityListener<any, any, any>>;
	#identityUpdatedListeners: Array<IdentityListener<any, any, any>>;
	#identityDeletedListeners: Array<IdentityListener<any, any, any>>;

	constructor();
	constructor(
		contextConstructors: Array<Decorator<any, any, any, any>>,
		rpc: Array<RpcDefinition<any, any, any, any, any, any>>,
		event: Array<EventDefinition<any, any, any, any, any>>,
		document: Array<DocumentDefinition<any, any, any, any, any>>,
		collection: Array<CollectionDefinition<any, any, any, any, any>>,
		eventListeners: Array<EventListener<any, any, any, any, any>>,
		documentSavingListeners: Array<
			DocumentAtomicListener<any, any, any, any, any>
		>,
		documentSavedListeners: Array<DocumentListener<any, any, any, any, any>>,
		documentDeletingListeners: Array<
			DocumentAtomicListener<any, any, any, any, any>
		>,
		documentDeletedListeners: Array<DocumentListener<any, any, any, any, any>>,
		identityCreatedListeners: Array<IdentityListener<any, any, any>>,
		identityUpdatedListeners: Array<IdentityListener<any, any, any>>,
		identityDeletedListeners: Array<IdentityListener<any, any, any>>,
	);
	constructor(
		context?: Array<Decorator<any, any, any, any>>,
		rpc?: Array<RpcDefinition<any, any, any, any, any, any>>,
		event?: Array<EventDefinition<any, any, any, any, any>>,
		document?: Array<DocumentDefinition<any, any, any, any, any>>,
		collection?: Array<CollectionDefinition<any, any, any, any, any>>,
		eventListeners?: Array<EventListener<any, any, any, any, any>>,
		documentSavingListeners?: Array<
			DocumentAtomicListener<any, any, any, any, any>
		>,
		documentSavedListeners?: Array<DocumentListener<any, any, any, any, any>>,
		documentDeletingListeners?: Array<
			DocumentAtomicListener<any, any, any, any, any>
		>,
		documentDeletedListeners?: Array<DocumentListener<any, any, any, any, any>>,
		identityCreatedListeners?: Array<IdentityListener<any, any, any>>,
		identityUpdatedListeners?: Array<IdentityListener<any, any, any>>,
		identityDeletedListeners?: Array<IdentityListener<any, any, any>>,
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
		decorator: Decorator<TDecoration, TDocument, TCollection, TNewContext>,
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
		const TInput extends TSchema,
		const TOutput extends TSchema,
	>(
		path: TPath,
		options: Omit<
			RpcDefinitionWithSecurity<TPath, TDecoration, TDocument, TCollection, TInput, TOutput>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc | [RpcDefinitionWithSecurity<TPath, any, any, any, TInput, TOutput>],
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
			RpcDefinitionWithoutSecurity<
				TPath,
				TDecoration,
				TDocument,
				TCollection,
				TInput,
				TOutput
			>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc | [RpcDefinitionWithoutSecurity<TPath, any, any, any, TInput, TOutput>],
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

	emits<const TPath extends Path, const TPayload extends TSchema>(
		path: TPath,
		options: Omit<
			EventDefinitionWithSecurity<TPath, TDecoration, TDocument, TCollection, TPayload>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent | [EventDefinitionWithSecurity<TPath, any, any, any, TPayload>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	emits<const TPath extends Path, const TPayload extends TSchema>(
		path: TPath,
		options: Omit<
			EventDefinitionWithoutSecurity<TPath, TPayload>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent | [EventDefinitionWithoutSecurity<TPath, TPayload>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	emits(
		path: any,
		options: any,
	): any {
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

	document<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			DocumentDefinitionWithSecurity<TPath, TDecoration, TDocument, TCollection, Schema>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent,
		TDocument | [DocumentDefinitionWithSecurity<TPath, any, any, any, Schema>],
		TCollection,
		TFile,
		TFolder
	>;
	document<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			DocumentDefinitionWithoutSecurity<TPath, Schema>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent,
		TDocument | [
			DocumentDefinitionWithoutSecurity<TPath, Schema>,
		],
		TCollection,
		TFile,
		TFolder
	>;
	document(
		path: any,
		options: any,
	): any {
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

	collection<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			CollectionDefinitionWithSecurity<TPath, TDecoration, TDocument, TCollection, Schema>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent,
		TDocument | [
			DocumentDefinitionWithoutSecurity<[...TPath, string], Schema>,
		],
		TCollection | [
			CollectionDefinitionWithSecurity<TPath, any, any, any, Schema>,
		],
		TFile,
		TFolder
	>;
	collection<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			CollectionDefinitionWithoutSecurity<TPath, Schema>,
			"path" | "matcher"
		>,
	): ApplicationBuilder<
		TDecoration,
		TRpc,
		TEvent,
		TDocument | [
			DocumentDefinitionWithoutSecurity<[...TPath, string], Schema>,
		],
		TCollection | [
			CollectionDefinitionWithoutSecurity<TPath, Schema>,
		],
		TFile,
		TFolder
	>;
	collection(
		path: any,
		options: any,
	): any {
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
		handler: EventListener<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TEventDefinition["payload"]
		>["handler"],
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
		handler: DocumentAtomicListener<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>["handler"],
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
		handler: DocumentListener<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>["handler"],
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
		handler: DocumentListener<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>["handler"],
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
		handler: DocumentAtomicListener<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>["handler"],
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
		handler: DocumentListener<
			TPath,
			TDecoration,
			TDocument,
			TCollection,
			TDocumentDefinition["schema"]
		>["handler"],
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
		handler: IdentityListener<TDecoration, TDocument, TCollection>["handler"],
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
		handler: IdentityListener<TDecoration, TDocument, TCollection>["handler"],
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
		handler: IdentityListener<TDecoration, TDocument, TCollection>["handler"],
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
		TOtherRpc extends Array<RpcDefinition<any, any, any, any, any, any>>,
		TOtherEvent extends Array<EventDefinition<any, any, any, any, any>>,
		TOtherDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
		TOtherCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
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
