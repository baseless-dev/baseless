// deno-lint-ignore-file no-explicit-any
import type { Static } from "@sinclair/typebox";
import type { Document, DocumentChange } from "@baseless/core/document";
import type { DocumentAtomic, DocumentListEntry, DocumentListOptions, TypedDocumentAtomic } from "@baseless/server/document-provider";
import type {
	CollectionDefinition,
	DocumentDefinition,
	EventDefinition,
	PickAtPath,
	RpcDefinition,
	WithSecurity,
} from "@baseless/server/types";
import type { Identity } from "@baseless/core/identity";
import type { ApplicationBuilder } from "@baseless/server/application-builder";
import { CommandCollectionWatch } from "@baseless/core/command";

export interface IClient extends AsyncDisposable {
	readonly clientId: string;
	readonly currentIdentity: Readonly<Identity> | undefined;
	setStorage: (storage: Storage) => void;
	onAuthenticationStateChange: (listener: (identity: Readonly<Identity> | undefined) => void | Promise<void>) => Disposable;
	rpc: IRpcsClient;
	collections: ICollectionsClient;
	documents: IDocumentsClient;
	events: IEventsClient;
}

export interface IRpcsClient<TInput = unknown, TOutput = unknown> {
	(key: string[], input: TInput, dedup?: boolean): Promise<TOutput>;
}

export interface ICollectionsClient {
	(key: string[]): ICollectionClient;
}

export interface ICollectionClient<TData = unknown> {
	list: (options?: Omit<DocumentListOptions, "prefix">) => AsyncIterableIterator<DocumentListEntry<TData>>;
	watch: (
		options?: Omit<CommandCollectionWatch, "kind" | "key">,
		abortSignal?: AbortSignal,
	) => AsyncIterableIterator<DocumentChange<TData>>;
}

export interface IDocumentsClient {
	(key: string[]): IDocumentClient;
	atomic: () => DocumentAtomic;
	getMany: (keys: string[][]) => Promise<Document[]>;
}

export interface IDocumentClient<TData = unknown> {
	get: () => Promise<Document<TData>>;
	watch: (abortSignal?: AbortSignal) => AsyncIterableIterator<DocumentChange<TData>>;
}

export interface IEventsClient {
	(key: string[]): IEventClient;
}

export interface IEventClient<TPayload = unknown> {
	publish: (payload: TPayload) => Promise<void>;
	subscribe: (abortSignal?: AbortSignal) => AsyncIterableIterator<TPayload>;
}

export interface TypedRpcsClient<TRpc extends Array<RpcDefinition<any, any, any>> = []> extends IRpcsClient {
	<
		const TRpcPath extends TRpc[number]["matcher"],
		const TRpcDefinition extends PickAtPath<TRpc, TRpcPath>,
	>(key: TRpcPath, input: Static<TRpcDefinition["input"]>, dedup?: boolean): Promise<Static<TRpcDefinition["output"]>>;
}

export interface TypedCollectionsClient<TCollection extends Array<CollectionDefinition<any, any>> = []> extends ICollectionClient {
	<
		const TCollectionPath extends TCollection[number]["matcher"],
		const TCollectionDefinition extends PickAtPath<TCollection, TCollectionPath>,
	>(key: TCollectionPath): ICollectionClient<Static<TCollectionDefinition["schema"]>>;
}

export interface TypedDocumentsClient<TDocument extends Array<DocumentDefinition<any, any>> = []> extends IDocumentsClient {
	<
		const TDocumentPath extends TDocument[number]["matcher"],
		const TDocumentDefinition extends PickAtPath<TDocument, TDocumentPath>,
	>(key: TDocumentPath): IDocumentClient<Static<TDocumentDefinition["schema"]>>;
	atomic: () => TypedDocumentAtomic<TDocument>;
	getMany: <
		const TDocumentPath extends TDocument[number]["matcher"],
	>(keys: TDocumentPath) => Promise<Document[]>;
}

export interface TypedEventsClient<TEvent extends Array<EventDefinition<any, any>> = []> extends IEventsClient {
	<
		const TEventPath extends TEvent[number]["matcher"],
		const TEventDefinition extends PickAtPath<TEvent, TEventPath>,
	>(key: TEventPath): IEventClient<Static<TEventDefinition["payload"]>>;
}

export interface TypedClient<
	TRpc extends Array<RpcDefinition<any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> extends IClient {
	rpc: TypedRpcsClient<TRpc>;
	documents: TypedDocumentsClient<TDocument>;
	collections: TypedCollectionsClient<TCollection>;
	events: TypedEventsClient<TEvent>;
}

// deno-fmt-ignore
export type TypedClientFromApplicationBuilder<T extends ApplicationBuilder> = T extends
	ApplicationBuilder<any, any, infer TRpc, infer TEvent, infer TDocument, infer TCollection, infer TFile, infer TFolder>
	? TypedClient<WithSecurity<TRpc>, WithSecurity<TEvent>, WithSecurity<TDocument>, WithSecurity<TCollection>, WithSecurity<TFile>, WithSecurity<TFolder>>
	: never;
