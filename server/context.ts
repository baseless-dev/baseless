import { Configuration } from "./config.ts";
import { CounterProvider } from "./providers/counter.ts";
import { IdentityProvider } from "./providers/identity.ts";
import { EmailProvider } from "./providers/email.ts";
// import { KVProvider } from "./providers/kv.ts";

/**
 * Baseless's context
 */
export interface Context {
	readonly config: Configuration;
	readonly counter: CounterProvider;
	readonly identity: IdentityProvider;
	readonly email: EmailProvider;
	// readonly kv: KVProvider;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
