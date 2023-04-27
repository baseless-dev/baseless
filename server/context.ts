import { Configuration } from "./config.ts";
import { AssetService } from "./services/asset.ts";
import { AuthenticationService } from "./services/auth.ts";
import { CounterService } from "./services/counter.ts";
import { IdentityService } from "./services/identity.ts";
import { KVService } from "./services/kv.ts";
import { SessionService } from "./services/session.ts";

/**
 * Baseless's context
 */
export type Context = {
	readonly config: Configuration;
	readonly asset: AssetService;
	readonly counter: CounterService;
	readonly kv: KVService;
	readonly identity: IdentityService;
	readonly session: SessionService;
	readonly auth: AuthenticationService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
};
