import type { AppRegistry } from "./app.ts";
import type { Document, DocumentAtomic, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";
import type { KVProvider, RateLimiterProvider } from "./provider.ts";
import type { Identity, IdentityChannel } from "@baseless/core/identity";
import type { Notification } from "@baseless/core/notification";
import { ref, type Reference } from "@baseless/core/ref";

/**
 * The full service bag injected into every handler. Contains document, KV,
 * notification, pubsub, and rate-limiter services, plus any app-defined
 * services.
 */
export type ServiceCollection<TRegistry extends AppRegistry = AppRegistry> = {
	document: DocumentService<TRegistry["documents"], TRegistry["collections"]>;
	kv: KVService;
	notification: NotificationService;
	pubsub: PubSubService<TRegistry["topics"]>;
	rateLimiter: RateLimiterService;
} & TRegistry["services"];

/**
 * Options for {@link DocumentService.list}, extending the core
 * {@link DocumentListOptions} with a typed reference prefix.
 */
export interface DocumentServiceListOptions<TPrefix = string> {
	readonly prefix: Reference<TPrefix>;
	readonly cursor?: string;
	readonly limit?: number;
}

/**
 * Typed document store service available inside every request handler.
 * Wraps the raw {@link DocumentProvider} with identity-aware authorization.
 *
 * @template TDocuments Map of document paths to value types.
 * @template TCollections Map of collection paths to document types.
 */
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

/** A single pre-condition check inside a {@link DocumentServiceAtomic} operation. */
export type DocumentServiceAtomicCheck = {
	type: "check";
	readonly ref: Reference<string>;
	readonly versionstamp: string | null;
};

/** A single mutation inside a {@link DocumentServiceAtomic} batch: either `"set"` or `"delete"`. */
export type DocumentServiceAtomicOperation =
	| { type: "delete"; readonly ref: Reference<string> }
	| {
		type: "set";
		readonly ref: Reference<string>;
		readonly data: unknown;
	};

/**
 * Fluent builder for atomic (all-or-nothing) document mutations with
 * optional pre-condition checks.
 *
 * @template TDocuments Map of document paths to value types.
 */
export interface DocumentServiceAtomic<TDocuments> {
	checks: DocumentServiceAtomicCheck[];
	operations: DocumentServiceAtomicOperation[];
	check<TPath extends keyof TDocuments>(ref: Reference<TPath>, versionstamp: string | null): DocumentServiceAtomic<TDocuments>;
	set<TPath extends keyof TDocuments>(ref: Reference<TPath>, value: TDocuments[TPath]): DocumentServiceAtomic<TDocuments>;
	delete<TPath extends keyof TDocuments>(ref: Reference<TPath>): DocumentServiceAtomic<TDocuments>;
	commit(signal?: AbortSignal): Promise<void>;
}

/** KV key-value store service, alias for {@link KVProvider}. */
export interface KVService extends KVProvider {}

/**
 * Notification delivery service. Sends notifications via identity channels.
 */
export interface NotificationService {
	notify(identityId: Identity["id"], notification: Notification, signal?: AbortSignal): Promise<boolean>;
	notifyChannel(identityId: Identity["id"], channel: string, notification: Notification, signal?: AbortSignal): Promise<boolean>;
	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, signal?: AbortSignal): Promise<boolean>;
}

/**
 * Publish/subscribe service for broadcasting messages to topic subscribers.
 *
 * @template TTopics Map of topic paths to their payload types.
 */
export interface PubSubService<TTopics> {
	publish<TTopic extends keyof TTopics>(
		ref: Reference<TTopic>,
		payload: TTopics[TTopic],
		signal?: AbortSignal,
	): Promise<void>;
}

/** Rate-limiter service, alias for {@link RateLimiterProvider}. */
export interface RateLimiterService extends RateLimiterProvider {}
