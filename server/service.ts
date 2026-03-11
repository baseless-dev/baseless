import type { AppRegistry, Auth } from "./app.ts";
import type { Document, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";
import type {
	StorageListEntry,
	StorageObject,
	StorageSignedDownloadUrlOptions,
	StorageSignedUploadUrlOptions,
	StorageSignedUrl,
} from "@baseless/core/storage";
import type { KVProvider, RateLimiterProvider } from "./provider.ts";
import type { Identity, IdentityChannel } from "@baseless/core/identity";
import type { Notification } from "@baseless/core/notification";
import type { PathToParams } from "@baseless/core/path";
import type { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import type { TStatement } from "@baseless/core/query";

/**
 * The full service bag injected into every handler. Contains document, KV,
 * notification, pubsub, and rate-limiter services, plus any app-defined
 * services.
 */
export type ServiceCollection<TRegistry extends AppRegistry = AppRegistry> = {
	auth: AuthService;
	document: DocumentService<TRegistry["documents"], TRegistry["collections"]>;
	kv: KVService;
	notification: NotificationService;
	pubsub: PubSubService<TRegistry["topics"]>;
	rateLimiter: RateLimiterService;
	storage: StorageService<TRegistry["files"], TRegistry["folders"]>;
	table: TableService<TRegistry["tables"]>;
} & TRegistry["services"];

export interface AuthService {
	authenticate(authorization: string, options?: { signal?: AbortSignal }): Promise<Auth>;
	revoke(authorization: string, options?: { signal?: AbortSignal }): Promise<void>;
	createSession(identity: Identity, issuedAt: number, scope: string[], options?: { signal?: AbortSignal }): Promise<AuthenticationTokens>;
	refreshSession(refreshToken: string, options?: { signal?: AbortSignal }): Promise<AuthenticationTokens>;
}

/**
 * Typed document store service available inside every request handler.
 * Wraps the raw {@link DocumentProvider} with identity-aware authorization.
 *
 * @template TDocuments Map of document paths to value types.
 * @template TCollections Map of collection paths to document types.
 */
export interface DocumentService<TDocuments, TCollections> {
	get<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: DocumentGetOptions,
	): Promise<Document<TDocuments[TPath]>>;
	getMany<TPath extends keyof TDocuments & string>(
		keys: Array<[path: TPath, params: PathToParams<TPath>]>,
		options?: DocumentGetOptions,
	): Promise<Array<Document<TDocuments[TPath]>>>;
	list<TPath extends keyof TCollections & string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number; signal?: AbortSignal },
	): ReadableStream<DocumentListEntry<TCollections[TPath]>>;
	atomic(): DocumentServiceAtomic<TDocuments>;
}

/** A single pre-condition check inside a {@link DocumentServiceAtomic} operation. */
export type DocumentServiceAtomicCheck = {
	type: "check";
	readonly key: string;
	readonly versionstamp: string | null;
};

/** A single mutation inside a {@link DocumentServiceAtomic} batch: either `"set"` or `"delete"`. */
export type DocumentServiceAtomicOperation =
	| { type: "delete"; readonly key: string }
	| {
		type: "set";
		readonly key: string;
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
	check<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		versionstamp: string | null,
	): DocumentServiceAtomic<TDocuments>;
	set<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		value: TDocuments[TPath],
	): DocumentServiceAtomic<TDocuments>;
	delete<TPath extends keyof TDocuments & string>(path: TPath, params: PathToParams<TPath>): DocumentServiceAtomic<TDocuments>;
	commit(options?: { signal?: AbortSignal }): Promise<void>;
}

/** KV key-value store service, alias for {@link KVProvider}. */
export interface KVService extends KVProvider {}

/**
 * Notification delivery service. Sends notifications via identity channels.
 */
export interface NotificationService {
	notify(identityId: Identity["id"], notification: Notification, options?: { signal?: AbortSignal }): Promise<boolean>;
	notifyChannel(
		identityId: Identity["id"],
		channel: string,
		notification: Notification,
		options?: { signal?: AbortSignal },
	): Promise<boolean>;
	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, options?: { signal?: AbortSignal }): Promise<boolean>;
}

/**
 * Publish/subscribe service for broadcasting messages to topic subscribers.
 *
 * @template TTopics Map of topic paths to their payload types.
 */
export interface PubSubService<TTopics> {
	publish<TTopic extends keyof TTopics & string>(
		path: TTopic,
		params: PathToParams<TTopic>,
		payload: TTopics[TTopic],
		options?: { signal?: AbortSignal },
	): Promise<void>;
}

/** Rate-limiter service, alias for {@link RateLimiterProvider}. */
export interface RateLimiterService extends RateLimiterProvider {}

/**
 * Table query service available inside every request handler.
 * Wraps the raw {@link TableProvider} with row-level and table-level
 * security enforcement.
 *
 * @template TTables Map of table names to their row types.
 */
export interface TableService<TTables> {
	/**
	 * Executes a query statement against the registered tables.
	 *
	 * The facade resolves table definitions, checks `tableSecurity` permissions,
	 * injects `rowSecurity` WHERE clauses, substitutes named parameters, and
	 * delegates to the underlying {@link TableProvider}.
	 *
	 * @template TParams Named parameter types extracted from the statement.
	 * @template TOutput The expected output type (row array for SELECT, void for mutations).
	 * @param statement The query AST statement wrapper.
	 * @param params A record of named parameter values to bind.
	 * @param signal Optional abort signal.
	 * @returns The query result.
	 */
	execute<TParams extends Record<string, unknown>, TOutput>(
		statement: TStatement<TParams, TOutput>,
		params: TParams,
		options?: { signal?: AbortSignal },
	): Promise<TOutput>;
}

/**
 * Typed storage service available inside every request handler.
 * Wraps the raw {@link StorageProvider} with identity-aware authorization.
 *
 * @template TFiles Map of file paths to their types.
 * @template TFolders Map of folder paths to their types.
 */
export interface StorageService<TFiles, TFolders> {
	/**
	 * Retrieves metadata for a stored file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param signal Optional abort signal.
	 * @returns The {@link StorageObject} metadata.
	 */
	getMetadata<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<StorageObject>;
	/**
	 * Generates a pre-signed URL for uploading a file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional upload options (content-type, metadata, expiry).
	 * @returns A {@link StorageSignedUrl} for the upload.
	 */
	getSignedUploadUrl<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedUploadUrlOptions,
	): Promise<StorageSignedUrl>;
	/**
	 * Generates a pre-signed URL for downloading a file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional download options (expiry).
	 * @returns A {@link StorageSignedUrl} for the download.
	 */
	getSignedDownloadUrl<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedDownloadUrlOptions,
	): Promise<StorageSignedUrl>;
	/**
	 * Stores a file with the given content.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param content The file content as a `ReadableStream`, `ArrayBuffer`, or `Blob`.
	 * @param options Optional upload options (content-type, metadata).
	 */
	put<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		content: ReadableStream<Uint8Array> | ArrayBuffer | Blob,
		options?: StorageSignedUploadUrlOptions,
	): Promise<void>;
	/**
	 * Retrieves the content of a stored file as a `ReadableStream`.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional options including abort signal.
	 * @returns A `ReadableStream` of the file content.
	 */
	get<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<ReadableStream<Uint8Array>>;
	/**
	 * Deletes a file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional options including abort signal.
	 */
	delete<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<void>;
	/**
	 * Lists files within a folder.
	 * @param prefix The folder path template.
	 * @param params Path parameters.
	 * @param options Optional listing options (cursor, limit).
	 * @returns A `ReadableStream` of {@link StorageListEntry} values.
	 */
	list<TPath extends keyof TFolders & string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number; signal?: AbortSignal },
	): ReadableStream<StorageListEntry>;
}
