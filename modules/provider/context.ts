import type { AuthIdentifier } from "https://baseless.dev/x/shared/auth.ts";
import type { IAuthProvider } from "./auth.ts";
import type { IDatabaseProvider } from "./database.ts";
import type { IKVProvider } from "./kv.ts";
import type { IMailProvider } from "./mail.ts";
import { Client } from "./client.ts";
import { IChannelProvider } from "./message.ts";

/**
 * Context
 */
export interface Context {
	/**
	 * Client
	 */
	readonly client: Client;
	/**
	 * Current authid
	 */
	readonly currentUserId?: AuthIdentifier;

	/**
	 * Auth provider
	 */
	readonly auth: IAuthProvider;

	/**
	 * Key-value provider
	 */
	readonly kv: IKVProvider;

	/**
	 * Database provider
	 */
	readonly database: IDatabaseProvider;

	/**
	 * Mail provider
	 */
	readonly mail: IMailProvider;

	/**
	 * Message provider
	 */
	// readonly channel: IChannelProvider;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
