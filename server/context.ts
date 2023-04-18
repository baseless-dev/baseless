import { Configuration } from "./config.ts";
import { AssetService } from "./services/asset.ts";
import { CounterService } from "./services/counter.ts";

/**
 * Baseless's context
 */
export type Context = {
	readonly config: Configuration;
	readonly asset: AssetService;
	readonly counter: CounterService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
};

export type NonExtendableContext = Omit<Context, "waitUntil">;
