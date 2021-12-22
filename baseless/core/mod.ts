export * from "./auth.ts";
export * from "./autoid.ts";
export * from "./clients.ts";
export * from "./context.ts";
export * from "./database.ts";
export * from "./functions.ts";
export * from "./kv.ts";
export * from "./mail.ts";

/**
 * Noop service rrror
 */
export class NoopServiceError extends Error {
	public name = "NoopServiceError";
}
