import type { Configuration } from "./config/config.ts";
import type { IAssetService } from "./services/asset.ts";
import type { IAuthenticationService } from "./services/auth.ts";
import type { ICounterService } from "./services/counter.ts";
import type { IDocumentService } from "./services/document.ts";
import type { IIdentityService } from "./services/identity.ts";
import type { IKVService } from "./services/kv.ts";
import type { ISessionService } from "./services/session.ts";
import type { TokenData } from "./token_data.ts";

/**
 * Baseless's context
 */
export interface IContext {
	readonly remoteAddress: string;
	readonly tokenData: TokenData | undefined;
	readonly config: Configuration;
	readonly asset: IAssetService;
	readonly counter: ICounterService;
	readonly kv: IKVService;
	readonly document: IDocumentService;
	readonly identity: IIdentityService;
	readonly session: ISessionService;
	readonly auth: IAuthenticationService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
