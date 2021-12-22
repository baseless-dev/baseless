import { AuthIdentifier } from "./auth.ts";

/**
 * Context
 */
export interface IContext {
	// /**
	//  * Client
	//  */
	// readonly client: Client;
	/**
	 * Current authid
	 */
	readonly currentUserId?: AuthIdentifier;

	// /**
	//  * Auth service
	//  */
	// readonly auth: IAuthService;

	// /**
	//  * Key-value service
	//  */
	// readonly kv: IKVService;

	// /**
	//  * Database service
	//  */
	// readonly database: IDatabaseService;

	// /**
	//  * Mail service
	//  */
	// readonly mail: IMailService;
}
