export class App {
	#clientId: string;
	#apiEndpoint: string;
	#fetch: typeof globalThis.fetch;

	constructor(
		clientId: string,
		apiEndpoint: string,
		fetch: typeof globalThis.fetch,
	) {
		this.#clientId = clientId;
		this.#apiEndpoint = apiEndpoint;
		this.#fetch = fetch;
	}

	get clientId(): string {
		return this.#clientId;
	}
	get apiEndpoint(): string {
		return this.#apiEndpoint;
	}
	get fetch(): typeof globalThis.fetch {
		return this.#fetch;
	}
}

export function isApp(value?: unknown): value is App {
	return !!value && value instanceof App;
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
	return new App(clientId, apiEndpoint, fetch);
}
