import {
	assertAuthenticationCeremonyResponse,
	type AuthenticationCeremonyResponse,
} from "../common/auth/ceremony/response.ts";
import { EventEmitter } from "../common/system/event_emitter.ts";
import { App } from "./app.ts";
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

export class AuthApp {
	#app: App;
	#tokens: AuthenticationTokens | undefined;
	#accessTokenExpiration: number | undefined;
	#pendingRefreshTokenRequest: Promise<void> | undefined;
	#expireTimeout: number | undefined;
	#persistence: Persistence;
	#onAuthStateChange: EventEmitter<[Identity | undefined]>;
	#storage: Storage;

	constructor(app: App) {
		this.#app = app;
		this.#onAuthStateChange = new EventEmitter<[Identity | undefined]>();

		const persistence =
			globalThis.localStorage.getItem(`baseless_${app.clientId}_persistence`) ??
				"local";
		this.#persistence = isPersistence(persistence) ? persistence : "local";
		this.#storage = this.persistence === "local"
			? globalThis.localStorage
			: globalThis.sessionStorage;

		const tokensString = this.#storage.getItem(
			`baseless_${app.clientId}_tokens`,
		);
		if (tokensString) {
			try {
				const tokens = JSON.parse(tokensString);
				assertAuthenticationTokens(tokens);
				this.#tokens = tokens;
			} catch (error) {
				console.error(
					`[baseless] failed to parse tokens from storage, got ${error}.`,
				);
				this.#storage.removeItem(`baseless_${app.clientId}_tokens`);
			}
		}
	}

	get clientId(): string {
		return this.#app.clientId;
	}

	get apiEndpoint(): string {
		return this.#app.apiEndpoint;
	}

	async fetch(
		input: URL | Request | string,
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
				`${this.apiEndpoint}/auth/refreshTokens`,
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

	get onAuthStateChange(): EventEmitter<[Identity | undefined]> {
		return this.#onAuthStateChange;
	}

	get storage(): Storage {
		return this.#storage;
	}

	get tokens(): Readonly<AuthenticationTokens> | undefined {
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
				`baseless_${this.clientId}_tokens`,
				JSON.stringify(tokens),
			);
		} else {
			this.#tokens = undefined;
			this.#accessTokenExpiration = undefined;
			this.#onAuthStateChange.emit(undefined);
			this.#storage.removeItem(`baseless_${this.clientId}_tokens`);
		}
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
		const tokens = oldStorage?.getItem(`baseless_${this.#app.clientId}_tokens`);
		if (tokens) {
			newStorage.setItem(`baseless_${this.#app.clientId}_tokens`, tokens);
			oldStorage.removeItem(`baseless_${this.#app.clientId}_tokens`);
		}
		this.#storage = newStorage;
		this.#persistence = persistence;
	}
}

export function isAuthApp(value?: unknown): value is AuthApp {
	return !!value && value instanceof AuthApp;
}
export function assertAuthApp(value?: unknown): asserts value is AuthApp {
	if (!isAuthApp(value)) {
		throw new AuthNotInitializedError();
	}
}
export class AuthNotInitializedError extends Error {}

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

export function initializeAuth(app: App): AuthApp {
	return new AuthApp(app);
}

export function getPersistence(app: AuthApp): Persistence {
	return app.persistence;
}

export function setPersistence(app: AuthApp, persistence: Persistence): void {
	app.persistence = persistence;
}

export function onAuthStateChange(
	app: AuthApp,
	listener: (identity: Identity | undefined) => void,
): () => void {
	assertAuthApp(app);
	return app.onAuthStateChange.listen(listener);
}

export async function getAuthenticationCeremony(
	app: AuthApp,
	state?: string,
): Promise<
	AuthenticationCeremonyResponse<
		Exclude<
			ReturnType<typeof getComponentAtPath>,
			AuthenticationCeremonyComponentConditional | undefined
		>
	>
> {
	assertAuthApp(app);
	let method = "GET";
	let body: string | undefined;
	const headers = new Headers();
	if (typeof state === "string") {
		method = "POST";
		headers.set("Content-Type", "application/json");
		body = JSON.stringify({ state });
	}
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/getAuthenticationCeremony`,
		{
			body,
			method,
		},
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponse(result.data);
	return result.data as any;
}

export async function submitAuthenticationIdentification(
	app: AuthApp,
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
	assertAuthApp(app);
	const body = JSON.stringify({
		type,
		identification,
		...(state ? { state } : undefined),
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/submitAuthenticationIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponse(result.data);
	if (isAuthenticationCeremonyResponseTokens(result.data)) {
		app.tokens = result.data;
	}
	return result.data as any;
}

export async function submitAuthenticationChallenge(
	app: AuthApp,
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
	assertAuthApp(app);
	const body = JSON.stringify({ type, challenge, state });
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/submitAuthenticationChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponse(result.data);
	if (isAuthenticationCeremonyResponseTokens(result.data)) {
		app.tokens = result.data;
	}
	return result.data as any;
}

export async function sendIdentificationChallenge(
	app: AuthApp,
	type: string,
	state: string,
): Promise<SendIdentificationChallengeResponse> {
	assertAuthApp(app);
	const body = JSON.stringify({ type, state });
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/sendIdentificationChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertSendIdentificationChallengeResponse(result.data);
	return result.data;
}

export async function sendIdentificationValidationCode(
	app: AuthApp,
	type: string,
	identification: string,
): Promise<SendIdentificationValidationCodeResponse> {
	assertAuthApp(app);
	const body = JSON.stringify({ type, identification });
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/sendIdentificationValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertSendIdentificationValidationCodeResponse(result.data);
	return result.data;
}

export async function confirmIdentificationValidationCode(
	app: AuthApp,
	type: string,
	identification: string,
	code: string,
): Promise<ConfirmIdentificationValidationCodeResponse> {
	assertAuthApp(app);
	const body = JSON.stringify({ type, identification, code });
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/confirmIdentificationValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertConfirmIdentificationValidationCodeResponse(result.data);
	return result.data;
}

export async function signOut(app: AuthApp): Promise<void> {
	assertAuthApp(app);
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/signOut`,
		{ method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	app.tokens = undefined;
}

export function getIdToken(app: AuthApp): string | undefined {
	assertAuthApp(app);
	return app.tokens?.id_token;
}

export function getIdentity(app: AuthApp): Identity | undefined {
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
	app: AuthApp,
): Promise<AuthenticationCeremonyResponseTokens> {
	assertAuthApp(app);
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/createAnonymousIdentity`,
		{ method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponseTokens(result.data);
	app.tokens = result.data;
	return result.data;
}

export async function createIdentity(
	app: AuthApp,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	assertAuthApp(app);
	const body = JSON.stringify({
		identificationType,
		identification,
		locale,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/createIdentity`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function addIdentification(
	app: AuthApp,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	assertAuthApp(app);
	const body = JSON.stringify({
		identificationType,
		identification,
		locale,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/addIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function addChallenge(
	app: AuthApp,
	challengeType: string,
	challenge: string,
	locale: string,
): Promise<void> {
	assertAuthApp(app);
	const body = JSON.stringify({
		challengeType,
		challenge,
		locale,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/addChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function sendChallengeValidationCode(
	app: AuthApp,
	type: string,
): Promise<SendChallengeValidationCodeResponse> {
	assertAuthApp(app);
	const body = JSON.stringify({ type });
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/sendChallengeValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertSendChallengeValidationCodeResponse(result.data);
	return result.data;
}

export async function confirmChallengeValidationCode(
	app: AuthApp,
	type: string,
	answer: string,
): Promise<ConfirmChallengeValidationCodeResponse> {
	assertAuthApp(app);
	const body = JSON.stringify({
		type,
		answer,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/confirmChallengeValidationCode`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertConfirmChallengeValidationCodeResponse(result.data);
	return result.data;
}

export async function updateIdentification(
	app: AuthApp,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	assertAuthApp(app);
	const body = JSON.stringify({
		identificationType,
		identification,
		locale,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/updateIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function updateChallenge(
	app: AuthApp,
	challengeType: string,
	challenge: string,
	locale: string,
): Promise<void> {
	assertAuthApp(app);
	const body = JSON.stringify({
		challengeType,
		challenge,
		locale,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/updateChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function deleteIdentification(
	app: AuthApp,
	identificationType: string,
	locale: string,
): Promise<void> {
	assertAuthApp(app);
	const body = JSON.stringify({
		identificationType,
		locale,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/deleteIdentification`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}

export async function deleteChallenge(
	app: AuthApp,
	challengeType: string,
	locale: string,
): Promise<void> {
	assertAuthApp(app);
	const body = JSON.stringify({
		challengeType,
		locale,
	});
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/deleteChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
}
