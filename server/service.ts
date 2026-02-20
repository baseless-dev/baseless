import type { AppRegistry } from "./app.ts";
import type { Document, DocumentAtomic, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";
import type { KVProvider, RateLimiterProvider } from "./provider.ts";
import type { Identity, IdentityChannel } from "@baseless/core/identity";
import type { Notification } from "@baseless/core/notification";
import { ref, type Reference } from "@baseless/core/ref";

export type ServiceCollection<TRegistry extends AppRegistry = AppRegistry> = {
	document: DocumentService<TRegistry["documents"], TRegistry["collections"]>;
	kv: KVService;
	notification: NotificationService;
	pubsub: PubSubService<TRegistry["topics"]>;
	rateLimiter: RateLimiterService;
} & TRegistry["services"];

export interface DocumentServiceListOptions<TPrefix = string> {
	readonly prefix: Reference<TPrefix>;
	readonly cursor?: string;
	readonly limit?: number;
}

export interface DocumentService<TDocuments, TCollections> {
	get<TPath extends keyof TDocuments>(
		ref: Reference<TPath>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Document<TDocuments[TPath]>>;
	getMany<TPath extends keyof TDocuments>(
		refs: Array<Reference<TPath>>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Array<Document<TDocuments[TPath]>>>;
	list<TPath extends keyof TCollections>(
		options: DocumentServiceListOptions<TPath>,
		signal?: AbortSignal,
	): ReadableStream<DocumentListEntry<TCollections[TPath]>>;
	atomic(): DocumentServiceAtomic<TDocuments>;
}

export type DocumentServiceAtomicCheck = {
	type: "check";
	readonly ref: Reference<string>;
	readonly versionstamp: string | null;
};

export type DocumentServiceAtomicOperation =
	| { type: "delete"; readonly ref: Reference<string> }
	| {
		type: "set";
		readonly ref: Reference<string>;
		readonly data: unknown;
	};

export interface DocumentServiceAtomic<TDocuments> {
	checks: DocumentServiceAtomicCheck[];
	operations: DocumentServiceAtomicOperation[];
	check<TPath extends keyof TDocuments>(ref: Reference<TPath>, versionstamp: string | null): DocumentServiceAtomic<TDocuments>;
	set<TPath extends keyof TDocuments>(ref: Reference<TPath>, value: TDocuments[TPath]): DocumentServiceAtomic<TDocuments>;
	delete<TPath extends keyof TDocuments>(ref: Reference<TPath>): DocumentServiceAtomic<TDocuments>;
	commit(signal?: AbortSignal): Promise<void>;
}

export interface KVService extends KVProvider {}

export interface NotificationService {
	notify(identityId: Identity["id"], notification: Notification, signal?: AbortSignal): Promise<boolean>;
	notifyChannel(identityId: Identity["id"], channel: string, notification: Notification, signal?: AbortSignal): Promise<boolean>;
	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, signal?: AbortSignal): Promise<boolean>;
}

export interface PubSubService<TTopics> {
	publish<TTopic extends keyof TTopics>(
		ref: Reference<TTopic>,
		payload: TTopics[TTopic],
		signal?: AbortSignal,
	): Promise<void>;
}

export interface RateLimiterService extends RateLimiterProvider {}
