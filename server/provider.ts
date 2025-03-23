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
import type { Auth, RegisteredContext } from "./app.ts";
import type { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
import type { AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import type { ServiceCollection } from "./service.ts";
import type { Notification } from "@baseless/core/notification";

export type { ID } from "@baseless/core/id";
export type { Auth, RegisteredContext } from "./app.ts";
export { AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
export {
	Document,
	DocumentAtomicCheck,
	DocumentAtomicCommitError,
	DocumentAtomicOperation,
	type DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentNotFoundError,
} from "@baseless/core/document";
export { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
export {
	type KVGetOptions,
	type KVKey,
	KVKeyNotFoundError,
	type KVListKey,
	type KVListOptions,
	type KVListResult,
	KVPutError,
	type KVPutOptions,
} from "@baseless/core/kv";
export type { QueueItem } from "@baseless/core/queue";
export type { ServiceCollection } from "./service.ts";
export type { Notification } from "@baseless/core/notification";

export abstract class DocumentAtomic {
	checks: Array<DocumentAtomicCheck> = [];
	operations: Array<DocumentAtomicOperation> = [];

	check(key: string, versionstamp: string | null): DocumentAtomic {
		this.checks.push({ type: "check", key, versionstamp });
		return this;
	}

	set(key: string, data: unknown): DocumentAtomic {
		this.operations.push({ type: "set", key, data });
		return this;
	}

	delete(key: string): DocumentAtomic {
		this.operations.push({ type: "delete", key });
		return this;
	}

	abstract commit(signal?: AbortSignal): Promise<void>;
}

export abstract class DocumentProvider {
	abstract get(key: string, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Document>;

	abstract getMany(keys: Array<string>, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Array<Document>>;

	abstract list(options: DocumentListOptions, signal?: AbortSignal): ReadableStream<DocumentListEntry>;

	abstract atomic(): DocumentAtomic;
}

export abstract class KVProvider {
	abstract get(key: string, options?: KVGetOptions, signal?: AbortSignal): Promise<KVKey>;
	abstract put(key: string, value: unknown, options?: KVPutOptions, signal?: AbortSignal): Promise<void>;
	abstract list(options: KVListOptions, signal?: AbortSignal): Promise<KVListResult>;
	abstract delete(key: string, signal?: AbortSignal): Promise<void>;
}

export abstract class QueueProvider {
	abstract enqueue(item: QueueItem, signal?: AbortSignal): Promise<void>;
	abstract dequeue(signal?: AbortSignal): ReadableStream<QueueItem>;
}

export type HubProviderTransferOptions = {
	auth: Auth;
	context: RegisteredContext;
	hubId: ID<"hub_">;
	request: Request;
	server: Server;
	signal?: AbortSignal;
};

export abstract class HubProvider {
	abstract transfer(options: HubProviderTransferOptions): Promise<Response>;
	abstract subscribe(key: string, hubId: ID<"hub_">, signal?: AbortSignal): Promise<void>;
	abstract unsubscribe(key: string, hubId: ID<"hub_">, signal?: AbortSignal): Promise<void>;
	abstract publish(key: string, payload: unknown, signal?: AbortSignal): Promise<void>;
}

export interface IdentityComponentProviderSkipSignInPromptOptions {
	componentId: string;
	context: RegisteredContext;
	identityComponent?: IdentityComponent;
	service: ServiceCollection;
}

export interface IdentityComponentProviderGetSignInPromptOptions {
	componentId: string;
	context: RegisteredContext;
	identityComponent?: IdentityComponent;
	service: ServiceCollection;
}

export interface IdentityComponentSendSignInPromptOptions {
	componentId: string;
	context: RegisteredContext;
	identityComponent?: IdentityComponent;
	locale: string;
	service: ServiceCollection;
}

export interface IdentityComponentProviderVerifySignInPromptOptions {
	componentId: string;
	context: RegisteredContext;
	identityComponent?: IdentityComponent;
	value: unknown;
	service: ServiceCollection;
}

export interface IdentityComponentProviderGetSetupPromptOptions {
	componentId: string;
	context: RegisteredContext;
	service: ServiceCollection;
}

export interface IdentityComponentProviderSetupIdentityComponentOptions {
	componentId: string;
	context: RegisteredContext;
	value: unknown;
	service: ServiceCollection;
}

export interface IdentityComponentProviderGetValidationPromptOptions {
	componentId: string;
	context: RegisteredContext;
	service: ServiceCollection;
}

export interface IdentityComponentProviderSendValidationPromptOptions {
	componentId: string;
	context: RegisteredContext;
	identityComponent?: IdentityComponent;
	locale: string;
	service: ServiceCollection;
}

export interface IdentityComponentProviderVerifyValidationPromptOptions {
	componentId: string;
	context: RegisteredContext;
	identityComponent?: IdentityComponent;
	value: unknown;
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

export abstract class NotificationChannelProvider {
	abstract send(identityChannel: IdentityChannel, notification: Notification, signal?: AbortSignal): Promise<boolean>;
}

export interface RateLimiterProviderLimitOptions {
	key: string;
	limit: number;
	period: number;
	signal?: AbortSignal;
}

export abstract class RateLimiterProvider {
	abstract limit(options: RateLimiterProviderLimitOptions): Promise<boolean>;
}
