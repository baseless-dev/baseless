import {
	AuthenticationCeremonyState,
	AuthenticationCeremonyStateSchema,
	AuthenticationSendPromptResult,
	AuthenticationSendPromptResultSchema,
	AuthenticationSubmitPromptState,
	AuthenticationSubmitPromptStateDoneSchema,
	AuthenticationSubmitPromptStateSchema,
	type AuthenticationTokens,
	AuthenticationTokensSchema,
} from "../lib/authentication/types.ts";
import { EventEmitter } from "../lib/event_emitter.ts";
import { type ID, IDSchema } from "../lib/identity/types.ts";
import { type App, isApp } from "./app.ts";
import { Assert, Value } from "../lib/typebox.ts";
import { throwIfApiError } from "./errors.ts";
import MemoryStorage from "./memory_storage.ts";

class AuthenticationApp {
	#app: App;
	#apiEndpoint: string;
	#tokens?: AuthenticationTokens;
	#accessTokenExpiration?: number;
	#pendingRefreshTokenRequest?: Promise<void>;
	#expireTimeout?: number;
	#persistence: Persistence;
	#storage: Storage;
	#onAuthStateChange: EventEmitter<[ID | undefined]>;

	constructor(
		app: App,
		apiEndpoint: string,
	) {
		this.#app = app;
		this.#apiEndpoint = apiEndpoint;
		const localPersistence = globalThis.localStorage.getItem(
			`baseless_${app.clientId}_persistence`,
		);
		this.#persistence = isPersistence(localPersistence)
			? localPersistence
			: "memory";
		this.#storage = this.#persistence === "local"
			? globalThis.localStorage
			: this.#persistence === "session"
			? globalThis.sessionStorage
			: new MemoryStorage();
		this.#onAuthStateChange = new EventEmitter<[ID | undefined]>();

		const tokensString = this.#storage.getItem(
			`baseless_${app.clientId}_tokens`,
		);
		if (tokensString) {
			try {
				const maybeTokens = JSON.parse(tokensString);
				Assert(AuthenticationTokensSchema, maybeTokens);
				this.tokens = maybeTokens;
			} catch (error) {
				console.error(
					`[baseless] failed to parse tokens from storage, got ${error}.`,
				);
				this.#storage.removeItem(`baseless_${app.clientId}_tokens`);
			}
		}
	}

	get apiEndpoint(): string {
		return this.#apiEndpoint;
	}

	get accessTokenExpiration(): number | undefined {
		return this.#accessTokenExpiration;
	}

	get pendingRefreshTokenRequest(): Promise<void> | undefined {
		return this.#pendingRefreshTokenRequest;
	}

	get expireTimeout(): number | undefined {
		return this.#expireTimeout;
	}

	get persistence(): Persistence {
		return this.#persistence;
	}

	set persistence(persistence: Persistence) {
		assertPersistence(persistence);
		if (persistence === this.#persistence) {
			return;
		}
		globalThis.localStorage.setItem(
			`baseless_${this.#app.clientId}_persistence`,
			persistence,
		);
		const oldStorage = this.#storage;
		const newStorage = persistence === "local"
			? globalThis.localStorage
			: persistence === "session"
			? globalThis.sessionStorage
			: new MemoryStorage();
		const tokens = oldStorage?.getItem(
			`baseless_${this.#app.clientId}_tokens`,
		);
		if (tokens) {
			oldStorage.removeItem(`baseless_${this.#app.clientId}_tokens`);
			newStorage.setItem(`baseless_${this.#app.clientId}_tokens`, tokens);
		}
		this.#storage = newStorage;
		this.#persistence = persistence;
	}

	get storage(): Storage {
		return this.#storage;
	}

	get onAuthStateChange(): EventEmitter<[ID | undefined]> {
		return this.#onAuthStateChange;
	}

	get tokens(): AuthenticationTokens | undefined {
		return this.#tokens ? { ...this.#tokens } : undefined;
	}

	set tokens(tokens: Readonly<AuthenticationTokens> | undefined) {
		clearTimeout(this.#expireTimeout);
		this.#expireTimeout = undefined;
		if (tokens) {
			Assert(AuthenticationTokensSchema, tokens);
			const { access_token, id_token, refresh_token } = tokens;
			tokens = { access_token, id_token, refresh_token };
			const { sub: identityId, meta } = JSON.parse(
				atob(id_token.split(".").at(1)!),
			);
			const identity = { id: identityId, meta };
			Assert(IDSchema, identity);
			const { exp: accessTokenExp = Number.MAX_VALUE } = JSON.parse(
				atob(access_token.split(".").at(1)!),
			);
			const { exp: refreshTokenExp = undefined } = refresh_token
				? JSON.parse(atob(refresh_token.split(".").at(1)!))
				: {};
			const expiration = parseInt(refreshTokenExp ?? accessTokenExp, 10);
			this.#tokens = tokens;
			this.#accessTokenExpiration = parseInt(accessTokenExp, 10);
			this.#onAuthStateChange.emit(identity);
			this.#expireTimeout = setTimeout(
				() => {
					this.tokens = undefined;
				},
				expiration * 1000 - Date.now(),
			);
			this.#storage.setItem(
				`baseless_${this.#app.clientId}_tokens`,
				JSON.stringify(tokens),
			);
		} else {
			this.#tokens = undefined;
			this.#accessTokenExpiration = undefined;
			this.#onAuthStateChange.emit(undefined);
			this.#storage.removeItem(`baseless_${this.#app.clientId}_tokens`);
		}
	}

	async fetchWithTokens(
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> {
		if (this.#pendingRefreshTokenRequest) {
			await this.#pendingRefreshTokenRequest;
		}
		const headers = new Headers(init?.headers);
		const now = Date.now() / 1000 >> 0;
		if (
			this.#tokens?.access_token && this.#tokens.refresh_token &&
			this.#accessTokenExpiration && this.#accessTokenExpiration <= now
		) {
			const refreshPromise = this.#app.fetch(
				`${this.#apiEndpoint}/refresh-tokens`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refresh_token: this.#tokens.refresh_token }),
				},
			);
			this.#pendingRefreshTokenRequest = refreshPromise
				.catch(() => {})
				.then(
					() => {
						this.#pendingRefreshTokenRequest = undefined;
					},
				);
			const resp = await refreshPromise;
			const result = await resp.json();
			throwIfApiError(result);
			Assert(AuthenticationTokensSchema, result.data);
			this.#tokens = result.data;
		}

		if (this.#tokens?.access_token) {
			headers.set("Authorization", `Bearer ${this.#tokens.access_token}`);
		}
		return this.#app.fetch(input, { ...init, headers });
	}
}

export type Persistence = "local" | "session" | "memory";

export function isPersistence(value?: unknown): value is Persistence {
	return value === "local" || value === "session" || value === "memory";
}

export function assertPersistence(
	value?: unknown,
): asserts value is Persistence {
	if (!isPersistence(value)) {
		throw new InvalidPersistenceError();
	}
}
export class InvalidPersistenceError extends Error {}

const authenticationApps = new Map<App["clientId"], AuthenticationApp>();
export function unsafe_getAuthentication(app: App): AuthenticationApp {
	assertInitializedAuthentication(app);
	return authenticationApps.get(app.clientId)!;
}

export class AuthenticationNotInitializedError extends Error {}

export function assertInitializedAuthentication(
	value?: unknown,
): asserts value is App {
	if (!isApp(value) || !authenticationApps.has(value.clientId)) {
		throw new AuthenticationNotInitializedError();
	}
}

export function initializeAuthentication(app: App, apiEndpoint: string): App {
	if (!authenticationApps.has(app.clientId)) {
		const auth = new AuthenticationApp(app, apiEndpoint);
		authenticationApps.set(app.clientId, auth);
	}

	return app;
}

export function fetchWithTokens(
	app: App,
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	assertInitializedAuthentication(app);
	return unsafe_getAuthentication(app).fetchWithTokens(input, init);
}

export function getPersistence(app: App): Persistence {
	assertInitializedAuthentication(app);
	return unsafe_getAuthentication(app).persistence;
}

export function setPersistence(app: App, persistence: Persistence): void {
	assertInitializedAuthentication(app);
	unsafe_getAuthentication(app).persistence = persistence;
}

export function onAuthenticationStateChange(
	app: App,
	listener: (identity: ID | undefined) => void,
): () => void {
	assertInitializedAuthentication(app);
	return unsafe_getAuthentication(app).onAuthStateChange.listen(listener);
}

export function getIdToken(app: App): string | undefined {
	const auth = unsafe_getAuthentication(app);
	return auth.tokens?.id_token;
}

export function getIdentity(app: App): ID | undefined {
	const id_token = getIdToken(app);
	if (!id_token) {
		return undefined;
	}
	const [, payload] = id_token.split(".");
	const { sub, meta } = JSON.parse(atob(payload));
	const identity = { id: sub, meta };
	Assert(IDSchema, identity);
	return identity;
}

export async function getCeremony(
	app: App,
	state?: string,
): Promise<AuthenticationCeremonyState> {
	assertInitializedAuthentication(app);
	const auth = unsafe_getAuthentication(app);
	let method = "GET";
	let body: string | undefined;
	const headers = new Headers();
	if (typeof state === "string") {
		method = "POST";
		headers.set("Content-Type", "application/json");
		body = JSON.stringify({ state });
	}
	const resp = await auth.fetchWithTokens(
		`${auth.apiEndpoint}/ceremony`,
		{
			body,
			method,
		},
	);
	const result = await resp.json();
	throwIfApiError(result);
	Assert(AuthenticationCeremonyStateSchema, result.data);
	return result.data;
}

export async function signOut(app: App): Promise<void> {
	const auth = unsafe_getAuthentication(app);
	try {
		const resp = await auth.fetchWithTokens(
			`${auth.apiEndpoint}/sign-out`,
			{ method: "POST" },
		);
		const result = await resp.json();
		throwIfApiError(result);
	} finally {
		auth.tokens = undefined;
	}
}

export async function submitPrompt(
	app: App,
	component: string,
	prompt: unknown,
	state?: string,
): Promise<AuthenticationSubmitPromptState> {
	assertInitializedAuthentication(app);
	const auth = unsafe_getAuthentication(app);
	const body = JSON.stringify({
		component,
		prompt,
		...(state ? { state } : undefined),
	});
	const resp = await auth.fetchWithTokens(
		`${auth.apiEndpoint}/submit-prompt`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	Assert(AuthenticationSubmitPromptStateSchema, result.data);
	if (Value.Check(AuthenticationSubmitPromptStateDoneSchema, result.data)) {
		const { access_token, id_token, refresh_token } = result.data;
		unsafe_getAuthentication(app).tokens = {
			access_token,
			id_token,
			refresh_token,
		};
	}
	return result.data;
}

export async function sendPrompt(
	app: App,
	component: string,
	locale: string,
	state?: string,
): Promise<AuthenticationSendPromptResult> {
	assertInitializedAuthentication(app);
	const auth = unsafe_getAuthentication(app);
	const body = JSON.stringify({ component, state, locale });
	const resp = await auth.fetchWithTokens(
		`${auth.apiEndpoint}/send-prompt`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	Assert(AuthenticationSendPromptResultSchema, result.data);
	return result.data;
}
