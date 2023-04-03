import { Configuration } from "./config.ts";
import { IdentityProvider } from "./providers/identity.ts";

/**
 * Baseless's context
 */
export interface Context {
	readonly config: Configuration;
	readonly identity: IdentityProvider;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
