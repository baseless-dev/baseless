import {
	type AuthenticationTokens,
	AuthenticationTokensSchema,
} from "../lib/auth/types.ts";
import { EventEmitter } from "../lib/event_emitter.ts";
import { type ID, IDSchema } from "../lib/identity/types.ts";
import { type App, isApp } from "./app.ts";
import { Assert } from "../deps.ts";
import { throwIfApiError } from "./errors.ts";

class AuthApp {
	#app: App;
	#tokens?: AuthenticationTokens;
	#accessTokenExpiration?: number;
	#pendingRefreshTokenRequest?: Promise<void>;
	#expireTimeout?: number;
	#persistence: Persistence;
	#storage: Storage;
	#onAuthStateChange: EventEmitter<[ID | undefined]>;

	constructor(
		app: App,
	) {
		this.#app = app;
		const localPersistence = globalThis.localStorage.getItem(
			`baseless_${app.clientId}_persistence`,
		);
		this.#persistence = isPersistence(localPersistence)
			? localPersistence
			: "local";
		this.#storage = this.#persistence === "local"
			? globalThis.localStorage
			: globalThis.sessionStorage;
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
		globalThis.localStorage.setItem(
			`baseless_${this.#app.clientId}_persistence`,
			persistence,
		);
		const oldStorage = this.#storage;
		const newStorage = persistence === "local"
			? globalThis.localStorage
			: globalThis.sessionStorage;
		const tokens = oldStorage?.getItem(
			`baseless_${this.#app.clientId}_tokens`,
		);
		if (tokens) {
			newStorage.setItem(`baseless_${this.#app.clientId}_tokens`, tokens);
			oldStorage.removeItem(`baseless_${this.#app.clientId}_tokens`);
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
				() => this.tokens = undefined,
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
				`${this.#app.apiEndpoint}/auth/refresh`,
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

export type Persistence = "local" | "session";

export function isPersistence(value?: unknown): value is Persistence {
	return value === "local" || value === "session";
}

export function assertPersistence(
	value?: unknown,
): asserts value is Persistence {
	if (!isPersistence(value)) {
		throw new InvalidPersistenceError();
	}
}
export class InvalidPersistenceError extends Error {}

const authApps = new Map<App["clientId"], AuthApp>();
function getAuth(app: App): AuthApp {
	if (!authApps.has(app.clientId)) {
		initializeAuth(app);
	}
	return authApps.get(app.clientId)!;
}

export class AuthNotInitializedError extends Error {}

export function assertInitializedAuth(
	value?: unknown,
): asserts value is App {
	if (!isApp(value) || !authApps.has(value.clientId)) {
		throw new AuthNotInitializedError();
	}
}

export function initializeAuth(app: App): App {
	if (!authApps.has(app.clientId)) {
		const auth = new AuthApp(app);
		authApps.set(app.clientId, auth);
	}

	return app;
}

export function fetchWithTokens(
	app: App,
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	assertInitializedAuth(app);
	return getAuth(app).fetchWithTokens(input, init);
}

export function getPersistence(app: App): Persistence {
	assertInitializedAuth(app);
	return getAuth(app).persistence;
}

export function setPersistence(app: App, persistence: Persistence): void {
	assertInitializedAuth(app);
	getAuth(app).persistence = persistence;
}

export function onAuthStateChange(
	app: App,
	listener: (identity: ID | undefined) => void,
): () => void {
	assertInitializedAuth(app);
	return getAuth(app).onAuthStateChange.listen(listener);
}

// export async function getAuthenticationCeremony(
// 	app: App,
// 	state?: string,
// ): Promise<
// 	AuthenticationCeremonyResponse<
// 		Exclude<
// 			ReturnType<typeof getComponentAtPath>,
// 			undefined
// 		>
// 	>
// > {
// 	assertInitializedAuth(app);
// 	const auth = getAuth(app);
// 	let method = "GET";
// 	let body: string | undefined;
// 	const headers = new Headers();
// 	if (typeof state === "string") {
// 		method = "POST";
// 		headers.set("Content-Type", "application/json");
// 		body = JSON.stringify({ state });
// 	}
// 	const resp = await auth.fetchWithTokens(
// 		`${app.apiEndpoint}/auth/ceremony`,
// 		{
// 			body,
// 			method,
// 		},
// 	);
// 	const result = await resp.json();
// 	throwIfApiError(result);
// 	assertAuthenticationCeremonyResponse(result.data);
// 	// deno-lint-ignore no-explicit-any
// 	return result.data as any;
// }

// export async function submitAuthenticationSignInPrompt(
// 	app: App,
// 	component: string,
// 	prompt: unknown,
// 	state?: string,
// ): Promise<
// 	AuthenticationCeremonyResponse<
// 		Exclude<
// 			ReturnType<typeof getComponentAtPath>,
// 			undefined
// 		>
// 	>
// > {
// 	assertInitializedAuth(app);
// 	const auth = getAuth(app);
// 	const body = JSON.stringify({
// 		component,
// 		prompt,
// 		...(state ? { state } : undefined),
// 	});
// 	const resp = await auth.fetchWithTokens(
// 		`${app.apiEndpoint}/auth/signIn/submitPrompt`,
// 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// 	);
// 	const result = await resp.json();
// 	throwIfApiError(result);
// 	assertAuthenticationCeremonyResponse(result.data);
// 	if (isAuthenticationCeremonyResponseTokens(result.data)) {
// 		getAuth(app).tokens = result.data;
// 	}
// 	// deno-lint-ignore no-explicit-any
// 	return result.data as any;
// }

// export async function sendAuthenticationSendInPrompt(
// 	app: App,
// 	component: string,
// 	state?: string,
// ): Promise<SendComponentPromptResponse> {
// 	assertInitializedAuth(app);
// 	const auth = getAuth(app);
// 	const body = JSON.stringify({ component, state });
// 	const resp = await auth.fetchWithTokens(
// 		`${app.apiEndpoint}/auth/signIn/sendPrompt`,
// 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// 	);
// 	const result = await resp.json();
// 	throwIfApiError(result);
// 	assertSendComponentPromptResponse(result.data);
// 	return result.data;
// }

// export async function sendAuthenticationComponentValidationCode(
// 	app: App,
// 	component: string,
// 	state?: string,
// ): Promise<SendComponentValidationCodeResponse> {
// 	assertInitializedAuth(app);
// 	const auth = getAuth(app);
// 	const body = JSON.stringify({ component, state });
// 	const resp = await auth.fetchWithTokens(
// 		`${app.apiEndpoint}/auth/component/sendValidationCode`,
// 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// 	);
// 	const result = await resp.json();
// 	throwIfApiError(result);
// 	assertSendComponentValidationCodeResponse(result.data);
// 	return result.data;
// }

// export async function confirmAuthenticationComponentValidationCode(
// 	app: App,
// 	code: string,
// ): Promise<ConfirmComponentValidationCodeResponse> {
// 	const auth = getAuth(app);
// 	const body = JSON.stringify({ code });
// 	const resp = await auth.fetchWithTokens(
// 		`${app.apiEndpoint}/auth/component/submitValidationCode`,
// 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// 	);
// 	const result = await resp.json();
// 	throwIfApiError(result);
// 	assertConfirmComponentValidationCodeResponse(result.data);
// 	return result.data;
// }

// export async function signOut(app: App): Promise<void> {
// 	const auth = getAuth(app);
// 	try {
// 		const resp = await auth.fetchWithTokens(
// 			`${app.apiEndpoint}/auth/signOut`,
// 			{ method: "POST" },
// 		);
// 		const result = await resp.json();
// 		throwIfApiError(result);
// 	} finally {
// 		auth.tokens = undefined;
// 	}
// }

// export function getIdToken(app: App): string | undefined {
// 	const auth = getAuth(app);
// 	return auth.tokens?.id_token;
// }

// export function getIdentity(app: App): ID | undefined {
// 	const id_token = getIdToken(app);
// 	if (!id_token) {
// 		return undefined;
// 	}
// 	const [, payload] = id_token.split(".");
// 	const { sub, meta } = JSON.parse(atob(payload));
// 	const identity = { id: sub, meta };
// 	assertID(identity);
// 	return identity;
// }

// // export async function createAnonymousIdentity(
// // 	app: App,
// // ): Promise<AuthenticationCeremonyResponseTokens> {
// // 	const auth = getAuth(app);
// // 	const resp = await auth.fetchWithTokens(
// // 		`${app.apiEndpoint}/auth/createAnonymousIdentity`,
// // 		{ method: "POST" },
// // 	);
// // 	const result = await resp.json();
// // 	throwIfApiError(result);
// // 	assertAuthenticationCeremonyResponseTokens(result);
// // 	auth.tokens = result;
// // 	return result;
// // }

// // export async function createIdentity(
// // 	app: App,
// // 	components: Array<{ id: string; prompt: unknown }>,
// // 	locale: string,
// // ): Promise<AuthenticationCeremonyResponseTokens | undefined> {
// // 	const auth = getAuth(app);
// // 	const body = JSON.stringify({
// // 		components,
// // 		locale,
// // 	});
// // 	const resp = await auth.fetchWithTokens(
// // 		`${app.apiEndpoint}/auth/createIdentity`,
// // 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// // 	);
// // 	const result = await resp.json();
// // 	throwIfApiError(result);
// // 	if (isAuthenticationCeremonyResponseTokens(result)) {
// // 		auth.tokens = result;
// // 		return result;
// // 	}
// // }

// // export async function addIdentityComponent(
// // 	app: App,
// // 	component: string,
// // 	prompt: unknown,
// // 	locale: string,
// // ): Promise<void> {
// // 	const auth = getAuth(app);
// // 	const body = JSON.stringify({
// // 		component,
// // 		prompt,
// // 		locale,
// // 	});
// // 	const resp = await auth.fetchWithTokens(
// // 		`${app.apiEndpoint}/auth/addIdentityComponent`,
// // 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// // 	);
// // 	const result = await resp.json();
// // 	throwIfApiError(result);
// // }

// // export async function updateIdentityComponent(
// // 	app: App,
// // 	component: string,
// // 	prompt: unknown,
// // 	locale: string,
// // ): Promise<void> {
// // 	const auth = getAuth(app);
// // 	const body = JSON.stringify({
// // 		component,
// // 		prompt,
// // 		locale,
// // 	});
// // 	const resp = await auth.fetchWithTokens(
// // 		`${app.apiEndpoint}/auth/updateIdentityComponent`,
// // 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// // 	);
// // 	const result = await resp.json();
// // 	throwIfApiError(result);
// // }

// // export async function deleteIdentityComponent(
// // 	app: App,
// // 	component: string,
// // 	locale: string,
// // ): Promise<void> {
// // 	const auth = getAuth(app);
// // 	const body = JSON.stringify({
// // 		component,
// // 		locale,
// // 	});
// // 	const resp = await auth.fetchWithTokens(
// // 		`${app.apiEndpoint}/auth/deleteIdentityComponent`,
// // 		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
// // 	);
// // 	const result = await resp.json();
// // 	throwIfApiError(result);
// // }
