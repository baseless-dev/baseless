import { Configuration } from "./config.ts";
import { AssetService } from "./services/asset.ts";

/**
 * Baseless's context
 */
export interface Context {
	readonly config: Configuration;
	readonly asset: AssetService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
