export interface App {
	readonly clientId: string;
	readonly fetch: typeof globalThis.fetch;
}

export function isApp(value?: unknown): value is App {
	return !!value && typeof value === "object" && "clientId" in value &&
		typeof value.clientId === "string" && "fetch" in value &&
		typeof value.fetch === "function";
}

export function assertApp(value?: unknown): asserts value is App {
	if (!isApp(value)) {
		throw new InvalidAppError();
	}
}

export class InvalidAppError extends Error {}

export function initializeApp(
	{ clientId, fetch = globalThis.fetch }: {
		clientId: string;
		fetch?: typeof globalThis.fetch;
	},
): App {
	return {
		clientId,
		fetch,
	};
}
