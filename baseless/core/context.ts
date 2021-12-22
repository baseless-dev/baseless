import { AuthIdentifier, IAuthService } from "./auth.ts";
import { Client } from "./clients.ts";
import { IKVService } from "./kv.ts";
import { IDatabaseService } from "./database.ts";
import { IMailService } from "./mail.ts";

/**
 * Context
 */
export interface IContext {
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
	readonly auth: IAuthService;

	/**
	 * Key-value service
	 */
	readonly kv: IKVService;

	/**
	 * Database service
	 */
	readonly database: IDatabaseService;

	/**
	 * Mail service
	 */
	readonly mail: IMailService;
}
