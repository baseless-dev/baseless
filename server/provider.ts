import type {
	Document,
	DocumentAtomicCheck,
	DocumentAtomicOperation,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
} from "@baseless/core/document";
import type { ID } from "@baseless/core/id";
import type { KVGetOptions, KVKey, KVListOptions, KVListResult, KVPutOptions } from "@baseless/core/kv";
import type { Server } from "./server.ts";
import type { QueueItem } from "@baseless/core/queue";
import type { AppRegistry, Auth } from "./app.ts";
import type { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
import type { AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import type { ServiceCollection } from "./service.ts";
import type { Notification } from "@baseless/core/notification";
import { App } from "@baseless/server";

export type { ID } from "@baseless/core/id";
export type { Auth } from "./app.ts";
export { AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
export {
	Document,
	DocumentAtomicCheck,
	DocumentAtomicOperation,
	type DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
} from "@baseless/core/document";
export { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
export { type KVGetOptions, type KVKey, type KVListKey, type KVListOptions, type KVListResult, type KVPutOptions } from "@baseless/core/kv";
export type { QueueItem } from "@baseless/core/queue";
export type { ServiceCollection } from "./service.ts";
export type { Notification } from "@baseless/core/notification";
export * from "@baseless/core/errors";

/**
 * Abstract base class for an atomic document operation batch (check, set,
 * delete). Implement {@link commit} to flush the batch to the
 * underlying store.
 */
export abstract class DocumentAtomic {
	checks: Array<DocumentAtomicCheck> = [];
	operations: Array<DocumentAtomicOperation> = [];

	/**
	 * Adds a versionstamp pre-condition to the batch.
	 * @param key The document key.
	 * @param versionstamp Expected versionstamp, or `null` to check that the
	 * document does not exist.
	 * @returns `this` for chaining.
	 */
	check(key: string, versionstamp: string | null): DocumentAtomic {
		this.checks.push({ type: "check", key, versionstamp });
		return this;
	}

	/**
	 * Adds a set operation to the batch.
	 * @param key The document key.
	 * @param data The value to write.
	 * @returns `this` for chaining.
	 */
	set(key: string, data: unknown): DocumentAtomic {
		this.operations.push({ type: "set", key, data });
		return this;
	}

	/**
	 * Adds a delete operation to the batch.
	 * @param key The document key to remove.
	 * @returns `this` for chaining.
	 */
	delete(key: string): DocumentAtomic {
		this.operations.push({ type: "delete", key });
		return this;
	}

	/**
	 * Flushes the accumulated checks and operations to the underlying store.
	 * @param signal Optional abort signal.
	 */
	abstract commit(signal?: AbortSignal): Promise<void>;
}

/**
 * Abstract document storage provider. Implement this class to back the
 * Baseless document service with any persistence layer.
 */
export abstract class DocumentProvider {
	/**
	 * Retrieves a single document by key.
	 * @param key The document path.
	 * @param options Optional read options.
	 * @param signal Optional abort signal.
	 * @returns The {@link Document} stored at `key`.
	 */
	abstract get(key: string, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Document>;

	/**
	 * Retrieves multiple documents in a single operation.
	 * @param keys Array of document paths to retrieve.
	 * @param options Optional read options.
	 * @param signal Optional abort signal.
	 * @returns An array of {@link Document} values in the same order as `keys`.
	 */
	abstract getMany(keys: Array<string>, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Array<Document>>;

	/**
	 * Lists documents matching the given options as a stream.
	 * @param options Listing options (prefix, cursor, limit, etc.).
	 * @param signal Optional abort signal.
	 * @returns A `ReadableStream` of {@link DocumentListEntry} values.
	 */
	abstract list(options: DocumentListOptions, signal?: AbortSignal): ReadableStream<DocumentListEntry>;

	/**
	 * Creates a new {@link DocumentAtomic} batch builder for this provider.
	 * @returns A fresh atomic batch.
	 */
	abstract atomic(): DocumentAtomic;
}

/**
 * Abstract key-value storage provider. Implement this class to supply KV
 * persistence (e.g. file-system, Redis, Deno KV).
 */
export abstract class KVProvider {
	/**
	 * Retrieves the value stored at `key`.
	 * @param key The KV key.
	 * @param options Optional read options.
	 * @param signal Optional abort signal.
	 * @returns The {@link KVKey} entry at the given key.
	 */
	abstract get(key: string, options?: KVGetOptions, signal?: AbortSignal): Promise<KVKey>;
	/**
	 * Stores `value` at `key` with optional TTL and expiration options.
	 * @param key The KV key.
	 * @param value The value to store.
	 * @param options Optional put options (e.g. `expireIn`).
	 * @param signal Optional abort signal.
	 */
	abstract put(key: string, value: unknown, options?: KVPutOptions, signal?: AbortSignal): Promise<void>;
	/**
	 * Lists entries matching the given options.
	 * @param options Listing options (prefix, cursor, limit, etc.).
	 * @param signal Optional abort signal.
	 * @returns A {@link KVListResult} page of matching entries.
	 */
	abstract list(options: KVListOptions, signal?: AbortSignal): Promise<KVListResult>;
	/**
	 * Removes the entry at `key`.
	 * @param key The KV key to delete.
	 * @param signal Optional abort signal.
	 */
	abstract delete(key: string, signal?: AbortSignal): Promise<void>;
}

/**
 * Abstract queue provider for durable, at-least-once message delivery.
 */
export abstract class QueueProvider {
	/**
	 * Adds `item` to the queue for later processing.
	 * @param item The item to enqueue.
	 * @param signal Optional abort signal.
	 */
	abstract enqueue(item: QueueItem, signal?: AbortSignal): Promise<void>;
	/**
	 * Returns a stream that emits dequeued items as they become available.
	 * @param signal Optional abort signal to close the stream.
	 * @returns A `ReadableStream` of {@link QueueItem} values.
	 */
	abstract dequeue(signal?: AbortSignal): ReadableStream<QueueItem>;
}

/** Options passed to {@link HubProvider.transfer} for each WebSocket upgrade request. */
export type HubProviderTransferOptions = {
	/** The {@link App} handling the connection. */
	app: App;
	/** Authentication context for the connecting client. */
	auth: Auth;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Unique identifier assigned to this hub connection. */
	hubId: ID<"hub_">;
	/** The original HTTP upgrade request. */
	request: Request;
	/** The server instance managing this connection. */
	server: Server<AppRegistry>;
	/** Optional abort signal to cancel the transfer. */
	signal?: AbortSignal;
};

/**
 * Abstract WebSocket hub provider. Manages connections and routes pub/sub
 * messages between the server and connected clients.
 */
export abstract class HubProvider {
	/**
	 * Upgrades the HTTP request to a WebSocket connection and begins handling
	 * messages for the given hub.
	 * @param options Transfer options including the request, auth, and hub ID.
	 * @returns A `Response` that completes the WebSocket upgrade handshake.
	 */
	abstract transfer(options: HubProviderTransferOptions): Promise<Response>;
	/**
	 * Subscribes the hub connection identified by `hubId` to pub/sub `path`.
	 * @param path The topic path.
	 * @param hubId The hub connection ID.
	 * @param signal Optional abort signal.
	 */
	abstract subscribe(path: string, hubId: ID<"hub_">, signal?: AbortSignal): Promise<void>;
	/**
	 * Removes the subscription of `hubId` from pub/sub `path`.
	 * @param path The topic path.
	 * @param hubId The hub connection ID.
	 * @param signal Optional abort signal.
	 */
	abstract unsubscribe(path: string, hubId: ID<"hub_">, signal?: AbortSignal): Promise<void>;
	/**
	 * Broadcasts `payload` to all hub connections subscribed to `path`.
	 * @param path The topic path.
	 * @param payload The payload to broadcast.
	 * @param signal Optional abort signal.
	 */
	abstract publish(path: string, payload: unknown, signal?: AbortSignal): Promise<void>;
}

/** Options passed to {@link IdentityComponentProvider.skipSignInPrompt}. */
export interface IdentityComponentProviderSkipSignInPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Existing identity component data, if any. */
	identityComponent?: IdentityComponent;
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.getSignInPrompt}. */
export interface IdentityComponentProviderGetSignInPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Existing identity component data, if any. */
	identityComponent?: IdentityComponent;
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.sendSignInPrompt}. */
export interface IdentityComponentSendSignInPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Existing identity component data, if any. */
	identityComponent?: IdentityComponent;
	/** BCP 47 locale string for the outgoing message. */
	locale: string;
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.verifySignInPrompt}. */
export interface IdentityComponentProviderVerifySignInPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Existing identity component data, if any. */
	identityComponent?: IdentityComponent;
	/** The value submitted by the user. */
	value: unknown;
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.getSetupPrompt}. */
export interface IdentityComponentProviderGetSetupPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.setupIdentityComponent}. */
export interface IdentityComponentProviderSetupIdentityComponentOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** The value submitted by the user during setup. */
	value: unknown;
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.getValidationPrompt}. */
export interface IdentityComponentProviderGetValidationPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.sendValidationPrompt}. */
export interface IdentityComponentProviderSendValidationPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Existing identity component data, if any. */
	identityComponent?: IdentityComponent;
	/** BCP 47 locale string for the outgoing message. */
	locale: string;
	/** Available services. */
	service: ServiceCollection;
}

/** Options passed to {@link IdentityComponentProvider.verifyValidationPrompt}. */
export interface IdentityComponentProviderVerifyValidationPromptOptions {
	/** The component identifier. */
	componentId: string;
	/** Application configuration. */
	configuration: AppRegistry["configuration"];
	/** Application context. */
	context: AppRegistry["context"];
	/** Existing identity component data, if any. */
	identityComponent?: IdentityComponent;
	/** The validation code or value submitted by the user. */
	value: unknown;
	/** Available services. */
	service: ServiceCollection;
}

/**
 * An Identity Component Provider.
 */
export abstract class IdentityComponentProvider {
	/**
	 * Check if a sign in prompt is required.
	 * @param options
	 * @returns Whether a sign in prompt is required.
	 */
	skipSignInPrompt?: (options: IdentityComponentProviderSkipSignInPromptOptions) => Promise<boolean>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for signing in.
	 * @param options
	 * @returns The sign in {@link AuthenticationComponentPrompt}.
	 */
	abstract getSignInPrompt: (options: IdentityComponentProviderGetSignInPromptOptions) => Promise<AuthenticationComponentPrompt>;

	/**
	 * Send a sign in prompt.
	 * @param options
	 * @returns Whether the prompt was sent.
	 */
	sendSignInPrompt?: (options: IdentityComponentSendSignInPromptOptions) => Promise<boolean>;

	/**
	 * Verify a sign in prompt.
	 * @param options
	 * @returns Whether the prompt was verified.
	 */
	abstract verifySignInPrompt: (options: IdentityComponentProviderVerifySignInPromptOptions) => Promise<boolean | Identity["id"]>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for setting up.
	 * @param options
	 * @returns The setup {@link AuthenticationComponentPrompt}.
	 */
	abstract getSetupPrompt: (options: IdentityComponentProviderGetSetupPromptOptions) => Promise<AuthenticationComponentPrompt>;

	/**
	 * Build an {@link IdentityComponent} from a value.
	 * @param options
	 * @returns Partial {@link IdentityComponent}
	 */
	abstract setupIdentityComponent: (
		options: IdentityComponentProviderSetupIdentityComponentOptions,
	) => Promise<[Omit<IdentityComponent, "identityId" | "componentId">, ...Omit<IdentityComponent | IdentityChannel, "identityId">[]]>;

	/**
	 * Retrieve an {@link AuthenticationComponentPrompt} for validating.
	 * @param options
	 * @returns The validation {@link AuthenticationComponentPrompt}.
	 */
	getValidationPrompt?: (options: IdentityComponentProviderGetValidationPromptOptions) => Promise<AuthenticationComponentPrompt>;

	/**
	 * Send a validation prompt.
	 * @param options
	 * @returns Whether the prompt was sent.
	 */
	sendValidationPrompt?: (options: IdentityComponentProviderSendValidationPromptOptions) => Promise<boolean>;

	/**
	 * Verify a validation prompt.
	 * @param options
	 * @returns Whether the prompt was verified.
	 */
	verifyValidationPrompt?: (options: IdentityComponentProviderVerifyValidationPromptOptions) => Promise<boolean>;
}

/**
 * Abstract notification channel provider. Implement this to deliver
 * {@link Notification}s through a specific channel (email, SMS, push, etc.).
 */
export abstract class NotificationChannelProvider {
	/**
	 * Sends `notification` to the identity channel.
	 * @param identityChannel The channel to deliver the notification to.
	 * @param notification The notification payload to send.
	 * @param signal Optional abort signal.
	 * @returns `true` if the notification was delivered successfully.
	 */
	abstract send(identityChannel: IdentityChannel, notification: Notification, signal?: AbortSignal): Promise<boolean>;
}

/** Options passed to {@link RateLimiterProvider.limit}. */
export interface RateLimiterProviderLimitOptions {
	/** The rate-limit bucket key (e.g. an IP address or user ID). */
	key: string;
	/** Maximum number of requests allowed within `period` milliseconds. */
	limit: number;
	/** Sliding-window duration in milliseconds. */
	period: number;
	/** Optional abort signal. */
	signal?: AbortSignal;
}

/**
 * Abstract rate-limiter provider. Implement this to enforce request-rate
 * limits backed by any storage layer.
 */
export abstract class RateLimiterProvider {
	/**
	 * Checks whether the request identified by `options.key` is within the
	 * allowed rate limit.
	 * @param options Limit options including key, limit, and period.
	 * @returns `true` if the request is allowed, `false` if the limit is exceeded.
	 */
	abstract limit(options: RateLimiterProviderLimitOptions): Promise<boolean>;
}
