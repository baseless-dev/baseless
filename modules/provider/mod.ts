export * from "./auth.ts";
export * from "./client.ts";
export * from "./database.ts";
export * from "./kv.ts";
export * from "./mail.ts";

/**
 * Noop Provider Error
 */
export class NoopProviderError extends Error {
	public name = "NoopProviderError";
}
