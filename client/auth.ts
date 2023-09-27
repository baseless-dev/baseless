import {
	assertAuthenticationCeremonyResponse,
	type AuthenticationCeremonyResponse,
} from "../common/auth/ceremony/response.ts";
import { EventEmitter } from "../common/system/event_emitter.ts";
import { App, isApp } from "./app.ts";
import { throwIfApiError } from "./errors.ts";
import {
	assertSendIdentificationValidationCodeResponse,
	type SendIdentificationValidationCodeResponse,
} from "../common/auth/send_identification_validation_code_response.ts";
import {
	assertConfirmIdentificationValidationCodeResponse,
	type ConfirmIdentificationValidationCodeResponse,
} from "../common/auth/confirm_identification_validation_code_response.ts";
import {
	assertSendIdentificationChallengeResponse,
	type SendIdentificationChallengeResponse,
} from "../common/auth/send_identification_challenge_response.ts";
import {
	assertAuthenticationCeremonyResponseTokens,
	type AuthenticationCeremonyResponseTokens,
	isAuthenticationCeremonyResponseTokens,
} from "../common/auth/ceremony/response.ts";
import {
	assertAuthenticationTokens,
	type AuthenticationTokens,
} from "../common/auth/tokens.ts";
import {
	assertConfirmChallengeValidationCodeResponse,
	type ConfirmChallengeValidationCodeResponse,
} from "../common/auth/confirm_challenge_validation_code_response.ts";
import {
	assertSendChallengeValidationCodeResponse,
	type SendChallengeValidationCodeResponse,
} from "../common/auth/send_challenge_validation_code_response.ts";
import { assertIdentity, type Identity } from "../common/identity/identity.ts";
import type { getComponentAtPath } from "../common/auth/ceremony/component/get_component_at_path.ts";
import type { AuthenticationCeremonyComponentConditional } from "../common/auth/ceremony/ceremony.ts";

class AuthApp {
	#app: App;
	#tokens?: AuthenticationTokens;
	#accessTokenExpiration?: number;
	#pendingRefreshTokenRequest?: Promise<void>;
	#expireTimeout?: number;
	#persistence: Persistence;
	#storage: Storage;
	#onAuthStateChange: EventEmitter<[Identity | undefined]>;

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
		this.#onAuthStateChange = new EventEmitter<[Identity | undefined]>();

		const tokensString = this.#storage.getItem(
			`baseless_${app.clientId}_tokens`,
		);
		if (tokensString) {
			try {
				const maybeTokens = JSON.parse(tokensString);
				assertAuthenticationTokens(maybeTokens);
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

	get onAuthStateChange(): EventEmitter<[Identity | undefined]> {
		return this.#onAuthStateChange;
	}

	get tokens(): AuthenticationTokens | undefined {
		return this.#tokens ? { ...this.#tokens } : undefined;
	}

	set tokens(tokens: Readonly<AuthenticationTokens> | undefined) {
		clearTimeout(this.#expireTimeout);
		this.#expireTimeout = undefined;
		if (tokens) {
			assertAuthenticationTokens(tokens);
			const { access_token, id_token, refresh_token } = tokens;
			tokens = { access_token, id_token, refresh_token };
			const { sub: identityId, meta } = JSON.parse(
				atob(id_token.split(".").at(1)!),
			);
			const identity = { id: identityId, meta };
			assertIdentity(identity);
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
				`${this.#app.apiEndpoint}/auth/refreshTokens`,
				{
					method: "POST",
					headers: { "X-Refresh-Token": this.#tokens.refresh_token },
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
			assertAuthenticationTokens(result.data);
			this.#tokens = result.data;
		}

		if (this.#tokens?.access_token) {
			headers.set("Authorization", `Bearer ${this.#tokens.access_token}`);
		}
		return this.#app.fetch(input, { ...init, headers });
	}
}

const authApps = new Map<App["clientId"], AuthApp>();
function getAuth(app: App): AuthApp {
	if (!authApps.has(app.clientId)) {
		initializeAuth(app);
	}
	return authApps.get(app.clientId)!;
}

export type Persistence = "local" | "session";

export class AuthNotInitializedError extends Error {}

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
	listener: (identity: Identity | undefined) => void,
): () => void {
	assertInitializedAuth(app);
	return getAuth(app).onAuthStateChange.listen(listener);
}

export async function getAuthenticationCeremony(
	app: App,
	state?: string,
): Promise<
	AuthenticationCeremonyResponse<
		Exclude<
			ReturnType<typeof getComponentAtPath>,
			AuthenticationCeremonyComponentConditional | undefined
		>
	>
> {
	assertInitializedAuth(app);
	const auth = getAuth(app);
	let method = "GET";
	let body: string | undefined;
	const headers = new Headers();
	if (typeof state === "string") {
		method = "POST";
		headers.set("Content-Type", "application/json");
		body = JSON.stringify({ state });
	}
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/getAuthenticationCeremony`,
		{
			body,
			method,
		},
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponse(result.data);
	// deno-lint-ignore no-explicit-any
	return result.data as any;
}

export async function submitAuthenticationIdentification(
	app: App,
	type: string,
	identification: string,
	state?: string,
): Promise<
	AuthenticationCeremonyResponse<
		Exclude<
			ReturnType<typeof getComponentAtPath>,
			AuthenticationCeremonyComponentConditional | undefined
		>
	>
> {
	assertInitializedAuth(app);
	const auth = getAuth(app);
	const body = JSON.stringify({
		type,
		identification,
		...(state ? { state } : undefined),
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/submitAuthenticationIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponse(result.data);
	if (isAuthenticationCeremonyResponseTokens(result.data)) {
		getAuth(app).tokens = result.data;
	}
	// deno-lint-ignore no-explicit-any
	return result.data as any;
}

export async function submitAuthenticationChallenge(
	app: App,
	type: string,
	challenge: string,
	state: string,
): Promise<
	AuthenticationCeremonyResponse<
		Exclude<
			ReturnType<typeof getComponentAtPath>,
			AuthenticationCeremonyComponentConditional | undefined
		>
	>
> {
	assertInitializedAuth(app);
	const auth = getAuth(app);
	const body = JSON.stringify({ type, challenge, state });
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/submitAuthenticationChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponse(result.data);
	if (isAuthenticationCeremonyResponseTokens(result.data)) {
		getAuth(app).tokens = result.data;
	}
	// deno-lint-ignore no-explicit-any
	return result.data as any;
}

export async function sendIdentificationChallenge(
	app: App,
	type: string,
	state: string,
): Promise<SendIdentificationChallengeResponse> {
	assertInitializedAuth(app);
	const auth = getAuth(app);
	const body = JSON.stringify({ type, state });
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/sendIdentificationChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertSendIdentificationChallengeResponse(result.data);
	return result.data;
}

export async function sendIdentificationValidationCode(
	app: App,
	type: string,
	identification: string,
): Promise<SendIdentificationValidationCodeResponse> {
	const auth = getAuth(app);
	const body = JSON.stringify({ type, identification });
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/sendIdentificationValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertSendIdentificationValidationCodeResponse(result.data);
	return result.data;
}

export async function confirmIdentificationValidationCode(
	app: App,
	type: string,
	identification: string,
	code: string,
): Promise<ConfirmIdentificationValidationCodeResponse> {
	const auth = getAuth(app);
	const body = JSON.stringify({ type, identification, code });
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/confirmIdentificationValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertConfirmIdentificationValidationCodeResponse(result.data);
	return result.data;
}

export async function signOut(app: App): Promise<void> {
	const auth = getAuth(app);
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/signOut`,
		{ method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	auth.tokens = undefined;
}

export function getIdToken(app: App): string | undefined {
	const auth = getAuth(app);
	return auth.tokens?.id_token;
}

export function getIdentity(app: App): Identity | undefined {
	const id_token = getIdToken(app);
	if (!id_token) {
		return undefined;
	}
	const [, payload] = id_token.split(".");
	const { sub, meta } = JSON.parse(atob(payload));
	const identity = { id: sub, meta };
	assertIdentity(identity);
	return identity;
}

export async function createAnonymousIdentity(
	app: App,
): Promise<AuthenticationCeremonyResponseTokens> {
	const auth = getAuth(app);
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/createAnonymousIdentity`,
		{ method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponseTokens(result.data);
	auth.tokens = result.data;
	return result.data;
}

export async function createIdentity(
	app: App,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		identificationType,
		identification,
		locale,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/createIdentity`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function addIdentification(
	app: App,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		identificationType,
		identification,
		locale,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/addIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function addChallenge(
	app: App,
	challengeType: string,
	challenge: string,
	locale: string,
): Promise<void> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		challengeType,
		challenge,
		locale,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/addChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function sendChallengeValidationCode(
	app: App,
	type: string,
): Promise<SendChallengeValidationCodeResponse> {
	const auth = getAuth(app);
	const body = JSON.stringify({ type });
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/sendChallengeValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertSendChallengeValidationCodeResponse(result.data);
	return result.data;
}

export async function confirmChallengeValidationCode(
	app: App,
	type: string,
	answer: string,
): Promise<ConfirmChallengeValidationCodeResponse> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		type,
		answer,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/confirmChallengeValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertConfirmChallengeValidationCodeResponse(result.data);
	return result.data;
}

export async function updateIdentification(
	app: App,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		identificationType,
		identification,
		locale,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/updateIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function updateChallenge(
	app: App,
	challengeType: string,
	challenge: string,
	locale: string,
): Promise<void> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		challengeType,
		challenge,
		locale,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/updateChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function deleteIdentification(
	app: App,
	identificationType: string,
	locale: string,
): Promise<void> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		identificationType,
		locale,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/deleteIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function deleteChallenge(
	app: App,
	challengeType: string,
	locale: string,
): Promise<void> {
	const auth = getAuth(app);
	const body = JSON.stringify({
		challengeType,
		locale,
	});
	const resp = await auth.fetchWithTokens(
		`${app.apiEndpoint}/auth/deleteChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}
