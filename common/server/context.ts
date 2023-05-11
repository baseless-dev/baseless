import type { Configuration } from "./config/config.ts";
import type { IAssetService } from "./services/asset.ts";
import type { IAuthenticationService } from "./services/auth.ts";
import type { ICounterService } from "./services/counter.ts";
import type { IIdentityService } from "./services/identity.ts";
import type { IKVService } from "./services/kv.ts";
import type { ISessionService } from "./services/session.ts";

/**
 * Baseless's context
 */
export type Context = {
	readonly remoteAddress: string;
	readonly config: Configuration;
	readonly asset: IAssetService;
	readonly counter: ICounterService;
	readonly kv: IKVService;
	readonly identity: IIdentityService;
	readonly session: ISessionService;
	readonly auth: IAuthenticationService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
};
