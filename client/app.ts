export interface App {
	readonly clientId: string;
	readonly apiEndpoint: string;
	readonly fetch: typeof globalThis.fetch;
}

export function isApp(value?: unknown): value is App {
	return !!value && typeof value === "object" && "clientId" in value &&
		typeof value.clientId === "string" && "apiEndpoint" in value &&
		typeof value.apiEndpoint === "string" && "fetch" in value &&
		typeof value.fetch === "function";
}

export function assertApp(value?: unknown): asserts value is App {
	if (!isApp(value)) {
		throw new InvalidAppError();
	}
}

export class InvalidAppError extends Error {}

export function initializeApp(
	{ clientId, apiEndpoint, fetch = globalThis.fetch }: {
		clientId: string;
		apiEndpoint: string;
		fetch?: typeof globalThis.fetch;
	},
): App {
	return {
		clientId,
		apiEndpoint,
		fetch,
	};
}
