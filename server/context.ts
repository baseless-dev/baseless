import type { Configuration } from "./config.ts";
import type { AssetService } from "./services/asset.ts";
import type { AuthenticationService } from "./services/auth.ts";
import type { CounterService } from "./services/counter.ts";
import type { IdentityService } from "./services/identity.ts";
import type { KVService } from "./services/kv.ts";
import type { SessionService } from "./services/session.ts";

/**
 * Baseless's context
 */
export type Context = {
	readonly remoteAddress: string;
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
