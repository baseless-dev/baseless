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

export class Application<
	TDecoration extends {} = {},
	TRpc extends Array<RpcDefinition<any, any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> {
	#decorator: Array<Decorator<any, any>>;
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
		contextConstructors: Array<Decorator<any, any>>,
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
		context?: Array<Decorator<any, any>>,
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
		this.#decorator = [...context ?? []];
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

	inspect(): {
		decorator: Array<Decorator<any, any>>;
		rpc: Array<RpcDefinition<any, any, any, any>>;
		event: Array<EventDefinition<any, any, any>>;
		document: Array<DocumentDefinition<any, any, any>>;
		collection: Array<CollectionDefinition<any, any, any>>;
		eventListeners: Array<EventListener<any, any, any>>;
		documentAtomicSetListeners: Array<DocumentAtomicListener<any, any, any>>;
		documentSetListeners: Array<DocumentListener<any, any, any>>;
		documentAtomicDeleteListeners: Array<
			DocumentAtomicListener<any, any, any>
		>;
		documentDeleteListeners: Array<DocumentListener<any, any, any>>;
		identityCreatedListeners: Array<IdentityListener<any>>;
		identityUpdatedListeners: Array<IdentityListener<any>>;
		identityDeletedListeners: Array<IdentityListener<any>>;
	} {
		return {
			decorator: [...this.#decorator],
			rpc: [...this.#rpc],
			event: [...this.#event],
			document: [...this.#document],
			collection: [...this.#collection],
			eventListeners: [...this.#eventListeners],
			documentAtomicSetListeners: [...this.#documentAtomicSetListeners],
			documentSetListeners: [...this.#documentSetListeners],
			documentAtomicDeleteListeners: [...this.#documentAtomicDeleteListeners],
			documentDeleteListeners: [...this.#documentDeleteListeners],
			identityCreatedListeners: [...this.#identityCreatedListeners],
			identityUpdatedListeners: [...this.#identityUpdatedListeners],
			identityDeletedListeners: [...this.#identityDeletedListeners],
		};
	}

	decorate<const TNewContext extends {}>(
		decorator: Decorator<TDecoration, TNewContext>,
	): Application<
		TDecoration & TNewContext,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			[...this.#decorator, decorator],
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
			RpcDefinitionWithSecurity<TPath, TDecoration, TInput, TOutput>,
			"path"
		>,
	): Application<
		TDecoration,
		TRpc | [RpcDefinitionWithSecurity<TPath, {}, TInput, TOutput>],
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
			RpcDefinitionWithoutSecurity<TPath, TDecoration, TInput, TOutput>,
			"path"
		>,
	): Application<
		TDecoration,
		TRpc | [RpcDefinitionWithoutSecurity<TPath, {}, TInput, TOutput>],
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
			this.#decorator,
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
			EventDefinitionWithSecurity<TPath, TDecoration, TPayload>,
			"path"
		>,
	): Application<
		TDecoration,
		TRpc,
		TEvent | [EventDefinitionWithSecurity<TPath, {}, TPayload>],
		TDocument,
		TCollection,
		TFile,
		TFolder
	>;
	emits<const TPath extends Path, const TPayload extends TSchema>(
		path: TPath,
		options: Omit<
			EventDefinitionWithoutSecurity<TPath, TPayload>,
			"path"
		>,
	): Application<
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
		return new Application(
			this.#decorator,
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
			DocumentDefinitionWithSecurity<TPath, TDecoration, Schema>,
			"path"
		>,
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument | [DocumentDefinitionWithSecurity<TPath, {}, Schema>],
		TCollection,
		TFile,
		TFolder
	>;
	document<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			DocumentDefinitionWithoutSecurity<TPath, Schema>,
			"path"
		>,
	): Application<
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
		return new Application(
			this.#decorator,
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
			CollectionDefinitionWithSecurity<TPath, TDecoration, Schema>,
			"path"
		>,
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection | [
			CollectionDefinitionWithSecurity<TPath, {}, Schema>,
		],
		TFile,
		TFolder
	>;
	collection<const TPath extends Path, const Schema extends TSchema>(
		path: TPath,
		options: Omit<
			CollectionDefinitionWithoutSecurity<TPath, Schema>,
			"path"
		>,
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
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
		return new Application(
			this.#decorator,
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
			TDecoration,
			TEventDefinition["payload"]
		>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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
			TDecoration,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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
			TDecoration,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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
			TDecoration,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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
			TDecoration,
			TDocumentDefinition["schema"]
		>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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
		handler: IdentityListener<TDecoration>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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
		handler: IdentityListener<TDecoration>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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
		handler: IdentityListener<TDecoration>["handler"],
	): Application<
		TDecoration,
		TRpc,
		TEvent,
		TDocument,
		TCollection,
		TFile,
		TFolder
	> {
		return new Application(
			this.#decorator,
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

	use<
		TOtherDecoration extends {},
		TOtherRpc extends Array<RpcDefinition<any, any, any, any>>,
		TOtherEvent extends Array<EventDefinition<any, any, any>>,
		TOtherDocument extends Array<DocumentDefinition<any, any, any>>,
		TOtherCollection extends Array<CollectionDefinition<any, any, any>>,
		TOtherFile extends Array<unknown>,
		TOtherFolder extends Array<unknown>,
	>(
		application: Application<
			TOtherDecoration,
			TOtherRpc,
			TOtherEvent,
			TOtherDocument,
			TOtherCollection,
			TOtherFile,
			TOtherFolder
		>,
	): Application<
		TDecoration | TOtherDecoration,
		[...TRpc, ...TOtherRpc],
		[...TEvent, ...TOtherEvent],
		[...TDocument, ...TOtherDocument],
		[...TCollection, ...TOtherCollection],
		[...TFile, ...TOtherFile],
		[...TFolder, ...TOtherFolder]
	> {
		return new Application(
			[...this.#decorator, ...application.#decorator],
			[...this.#rpc, ...application.#rpc],
			[...this.#event, ...application.#event],
			[...this.#document, ...application.#document],
			[...this.#collection, ...application.#collection],
			[...this.#eventListeners, ...application.#eventListeners],
			[
				...this.#documentAtomicSetListeners,
				...application.#documentAtomicSetListeners,
			],
			[...this.#documentSetListeners, ...application.#documentSetListeners],
			[
				...this.#documentAtomicDeleteListeners,
				...application.#documentAtomicDeleteListeners,
			],
			[...this.#documentDeleteListeners, ...application.#documentDeleteListeners],
			[...this.#identityCreatedListeners, ...application.#identityCreatedListeners],
			[...this.#identityUpdatedListeners, ...application.#identityUpdatedListeners],
			[...this.#identityDeletedListeners, ...application.#identityDeletedListeners],
		);
	}

	// folder(path, { mimetypes, extensions, security? })
	// file(path, { mimetypes, extensions, security? })
	// room(path, { security? })
}
