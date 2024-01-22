import type { ICounterService } from "../../common/services/counter.ts";
import type { IDocumentService } from "../../common/services/document.ts";
import type { IKVService } from "../../common/services/kv.ts";

export interface Context {
	readonly counter: ICounterService;
	readonly kv: IKVService;
	readonly document: IDocumentService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
