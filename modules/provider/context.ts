import { AuthIdentifier } from "https://baseless.dev/x/shared/deno/auth.ts";
import { IAuthProvider } from "./auth.ts";
import { IDatabaseProvider } from "./database.ts";
import { IKVProvider } from "./kv.ts";
import { IMailProvider } from "./mail.ts";
import { Client } from "./client.ts";

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
	 * Auth service
	 */
	readonly auth: IAuthProvider;

	/**
	 * Key-value service
	 */
	readonly kv: IKVProvider;

	/**
	 * Database service
	 */
	readonly database: IDatabaseProvider;

	/**
	 * Mail service
	 */
	readonly mail: IMailProvider;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
