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

/**
 * The untyped version of {@link ServiceCollection} that doesn't require generic type parameters.
 */
export interface AnyServiceCollection {
	auth: AuthService;
	document: AnyDocumentService;
	kv: KVService;
	notification: NotificationService;
	pubsub: AnyPubSubService;
	rateLimiter: RateLimiterService;
	storage: AnyStorageService;
	table: AnyTableService;
}

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
	/**
	 * Retrieves a document by its path and parameters.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional get options (e.g. abort signal).
	 * @returns The {@link Document}.
	 */
	get<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: DocumentGetOptions,
	): Promise<Document<TDocuments[TPath]>>;
	/**
	 * Retrieves multiple documents by their paths and parameters.
	 * @param keys An array of tuples containing the file path template and corresponding parameters.
	 * @param options Optional get options (e.g. abort signal).
	 * @returns An array of {@link Document} objects corresponding to the requested keys.
	 */
	getMany<TPath extends keyof TDocuments & string>(
		keys: Array<[path: TPath, params: PathToParams<TPath>]>,
		options?: DocumentGetOptions,
	): Promise<Array<Document<TDocuments[TPath]>>>;
	/**
	 * Lists documents in a collection.
	 * @param prefix The collection prefix.
	 * @param params Path parameters.
	 * @param options Optional list options (e.g. cursor, limit, abort signal).
	 * @returns A stream of {@link DocumentListEntry} objects.
	 */
	list<TPath extends keyof TCollections & string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number; signal?: AbortSignal },
	): ReadableStream<DocumentListEntry<TCollections[TPath]>>;
	/**
	 * Begins an atomic operation batch for multiple document mutations with optional pre-condition checks.
	 * @returns A {@link DocumentServiceAtomic} builder for constructing the batch operation.
	 */
	atomic(): DocumentServiceAtomic<TDocuments>;
}

/**
 * Untyped version of {@link DocumentService} that doesn't require generic type parameters.
 */
export interface AnyDocumentService {
	/**
	 * Retrieves a document by its path and parameters.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional get options (e.g. abort signal).
	 * @returns The {@link Document}.
	 */
	get<TPath extends string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: DocumentGetOptions,
	): Promise<Document<unknown>>;
	/**
	 * Retrieves multiple documents by their paths and parameters.
	 * @param keys An array of tuples containing the file path template and corresponding parameters.
	 * @param options Optional get options (e.g. abort signal).
	 * @returns An array of {@link Document} objects corresponding to the requested keys.
	 */
	getMany<TPath extends string>(
		keys: Array<[path: TPath, params: PathToParams<TPath>]>,
		options?: DocumentGetOptions,
	): Promise<Array<Document<unknown>>>;
	/**
	 * Lists documents in a collection.
	 * @param prefix The collection prefix.
	 * @param params Path parameters.
	 * @param options Optional list options (e.g. cursor, limit, abort signal).
	 * @returns A stream of {@link DocumentListEntry} objects.
	 */
	list<TPath extends string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number; signal?: AbortSignal },
	): ReadableStream<DocumentListEntry<string>>;
	/**
	 * Begins an atomic operation batch for multiple document mutations with optional pre-condition checks.
	 * @returns A {@link AnyDocumentServiceAtomic} builder for constructing the batch operation.
	 */
	atomic(): AnyDocumentServiceAtomic;
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
	/**
	 * Adds a pre-condition check to the atomic operation batch.
	 * @param path The document path.
	 * @param params The path parameters.
	 * @param versionstamp The expected versionstamp.
	 * @returns The updated atomic operation builder.
	 */
	check<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		versionstamp: string | null,
	): DocumentServiceAtomic<TDocuments>;
	/**
	 * Adds a document mutation to the atomic operation batch.
	 * @param path The document path.
	 * @param params The path parameters.
	 * @param value The new value for the document.
	 * @returns The updated atomic operation builder.
	 */
	set<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		value: TDocuments[TPath],
	): DocumentServiceAtomic<TDocuments>;
	/**
	 * Adds a document deletion to the atomic operation batch.
	 * @param path The document path.
	 * @param params The path parameters.
	 * @returns The updated atomic operation builder.
	 */
	delete<TPath extends keyof TDocuments & string>(path: TPath, params: PathToParams<TPath>): DocumentServiceAtomic<TDocuments>;
	/**
	 * Commits the atomic operation batch.
	 * @param options Optional commit options (e.g. abort signal).
	 * @returns A promise resolving when the batch is committed.
	 */
	commit(options?: { signal?: AbortSignal }): Promise<void>;
}

/**
 * Untyped version of {@link DocumentServiceAtomic} that doesn't require generic type parameters.
 */
export interface AnyDocumentServiceAtomic {
	checks: DocumentServiceAtomicCheck[];
	operations: DocumentServiceAtomicOperation[];
	/**
	 * Adds a pre-condition check to the atomic operation batch.
	 * @param path The document path.
	 * @param params The path parameters.
	 * @param versionstamp The expected versionstamp.
	 * @returns The updated atomic operation builder.
	 */
	check<TPath extends string>(path: TPath, params: PathToParams<TPath>, versionstamp: string | null): AnyDocumentServiceAtomic;
	/**
	 * Adds a document mutation to the atomic operation batch.
	 * @param path The document path.
	 * @param params The path parameters.
	 * @param value The new value for the document.
	 * @returns The updated atomic operation builder.
	 */
	set<TPath extends string>(path: TPath, params: PathToParams<TPath>, value: unknown): AnyDocumentServiceAtomic;
	/**
	 * Adds a document deletion to the atomic operation batch.
	 * @param path The document path.
	 * @param params The path parameters.
	 * @returns The updated atomic operation builder.
	 */
	delete<TPath extends string>(path: TPath, params: PathToParams<TPath>): AnyDocumentServiceAtomic;
	/**
	 * Commits the atomic operation batch.
	 * @param options Optional commit options (e.g. abort signal).
	 * @returns A promise resolving when the batch is committed.
	 */
	commit(options?: { signal?: AbortSignal }): Promise<void>;
}

/** KV key-value store service, alias for {@link KVProvider}. */
export interface KVService extends KVProvider {}

/**
 * Notification delivery service. Sends notifications via identity channels.
 */
export interface NotificationService {
	/**
	 * Sends a notification to a specific identity.
	 * @param identityId The identity ID.
	 * @param notification The notification to send.
	 * @param options Optional abort signal.
	 * @returns A promise resolving to a boolean indicating success.
	 */
	notify(identityId: Identity["id"], notification: Notification, options?: { signal?: AbortSignal }): Promise<boolean>;
	/**
	 * Sends a notification to a specific identity channel.
	 * @param identityId The identity ID.
	 * @param channel The channel to notify.
	 * @param notification The notification to send.
	 * @param options Optional abort signal.
	 * @returns A promise resolving to a boolean indicating success.
	 */
	notifyChannel(
		identityId: Identity["id"],
		channel: string,
		notification: Notification,
		options?: { signal?: AbortSignal },
	): Promise<boolean>;
	/**
	 * Sends a notification to a specific identity channel without checking permissions.
	 * @param identityChannel The identity channel to notify.
	 * @param notification The notification to send.
	 * @param options Optional abort signal.
	 * @returns A promise resolving to a boolean indicating success.
	 */
	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, options?: { signal?: AbortSignal }): Promise<boolean>;
}

/**
 * Publish/subscribe service for broadcasting messages to topic subscribers.
 *
 * @template TTopics Map of topic paths to their payload types.
 */
export interface PubSubService<TTopics> {
	/**
	 * Publishes a message to a specific topic.
	 * @param path The topic path.
	 * @param params The path parameters.
	 * @param payload The message payload.
	 * @param options Optional abort signal.
	 * @returns A promise resolving when the message is published.
	 */
	publish<TTopic extends keyof TTopics & string>(
		path: TTopic,
		params: PathToParams<TTopic>,
		payload: TTopics[TTopic],
		options?: { signal?: AbortSignal },
	): Promise<void>;
}

/**
 * Untyped version of {@link PubSubService} that doesn't require generic type parameters.
 */
export interface AnyPubSubService {
	/**
	 * Publishes a message to a specific topic.
	 * @param path The topic path.
	 * @param params The path parameters.
	 * @param payload The message payload.
	 * @param options Optional abort signal.
	 * @returns A promise resolving when the message is published.
	 */
	publish<TTopic extends string>(
		path: TTopic,
		params: PathToParams<TTopic>,
		payload: unknown,
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
 * Untyped version of {@link TableService} that doesn't require generic type parameters.
 */
export interface AnyTableService {
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

export interface AnyStorageService {
	/**
	 * Retrieves metadata for a stored file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param signal Optional abort signal.
	 * @returns The {@link StorageObject} metadata.
	 */
	getMetadata<TPath extends string>(
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
	getSignedUploadUrl<TPath extends string>(
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
	getSignedDownloadUrl<TPath extends string>(
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
	put<TPath extends string>(
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
	get<TPath extends string>(
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
	delete<TPath extends string>(
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
	list<TPath extends string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number; signal?: AbortSignal },
	): ReadableStream<StorageListEntry>;
}
