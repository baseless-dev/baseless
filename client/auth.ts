import {
	assertAuthenticationCeremonyResponse,
	type AuthenticationCeremonyResponse,
} from "../common/auth/ceremony/response.ts";
import { EventEmitter } from "../common/system/event_emitter.ts";
import { type App, assertApp } from "./app.ts";
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
} from "../common/auth/ceremony/response/tokens.ts";
import {
	assertAuthenticationTokens,
	type AuthenticationTokens,
	isAuthenticationTokens,
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
export class InvalidPersistenceError extends Error { }

const tokenMap = new Map<string, AuthenticationTokens | undefined>();
const onAuthStateChangeMap = new Map<
	string,
	EventEmitter<[Identity | undefined]>
>();
const storageMap = new Map<string, Storage>();

function assertInitializedAuth(app: App): asserts app is App {
	if (!tokenMap.has(app.clientId)) {
		throw new AuthNotInitializedError();
	}
}

function getTokens(app: App): AuthenticationTokens | undefined {
	assertApp(app);
	assertInitializedAuth(app);
	return tokenMap.get(app.clientId);
}

function setTokens(
	app: App,
	tokens: AuthenticationTokens | undefined,
	delayed = false,
): void {
	assertApp(app);
	assertInitializedAuth(app);
	let identity: Identity | undefined;
	if (isAuthenticationTokens(tokens)) {
		const { access_token, id_token, refresh_token } = tokens;
		tokens = { access_token, id_token, refresh_token };
		const [, payload] = id_token.split(".");
		const { sub, meta } = JSON.parse(atob(payload));
		identity = { id: sub, meta };
		assertIdentity(identity);
	}
	tokenMap.set(app.clientId, tokens);
	getStorage(app).setItem(
		`baseless_${app.clientId}_tokens`,
		JSON.stringify(tokens),
	);
	// TODO save identity from id_token
	if (delayed) {
		setTimeout(() => onAuthStateChangeMap.get(app.clientId)!.emit(identity), 1);
	}
	onAuthStateChangeMap.get(app.clientId)!.emit(identity);
}

function getOnAuthStateChange(app: App): EventEmitter<[Identity | undefined]> {
	assertApp(app);
	assertInitializedAuth(app);
	return onAuthStateChangeMap.get(app.clientId)!;
}

function getStorage(app: App): Storage {
	assertApp(app);
	assertInitializedAuth(app);
	return storageMap.get(app.clientId)!;
}

export class AuthNotInitializedError extends Error { }

export function initializeAuth(app: App): App {
	assertApp(app);
	if (tokenMap.has(app.clientId)) {
		return app;
	}
	const persistence =
		globalThis.localStorage.getItem(`baseless_${app.clientId}_persistence`) ??
		"local";
	const storage = persistence === "local"
		? globalThis.localStorage
		: globalThis.sessionStorage;
	const onTokenChange = new EventEmitter<[Identity | undefined]>();

	storageMap.set(app.clientId, storage);
	onAuthStateChangeMap.set(app.clientId, onTokenChange);
	tokenMap.set(app.clientId, undefined);

	const tokensString = storage.getItem(`baseless_${app.clientId}_tokens`);
	if (tokensString) {
		try {
			const tokens = JSON.parse(tokensString);
			assertAuthenticationTokens(tokens);
			setTokens(app, tokens, true);
		} catch (error) {
			console.error(
				`[baseless] failed to parse tokens from storage, got ${error}.`,
			);
			storage.removeItem(`baseless_${app.clientId}_tokens`);
		}
	}
	return {
		...app,
		fetch(
			input: URL | Request | string,
			init?: RequestInit,
		): Promise<Response> {
			const headers = new Headers(init?.headers);
			const tokens = getTokens(app);
			if (tokens?.access_token) {
				headers.set("Authorization", `Bearer ${tokens.access_token}`);
			}
			return app.fetch(input, { ...init, headers });
		},
	};
}

export function getPersistence(app: App): Persistence {
	assertApp(app);
	assertInitializedAuth(app);
	const persistence =
		globalThis.localStorage.getItem(`baseless_${app.clientId}_persistence`) ??
		"local";
	assertPersistence(persistence);
	return persistence;
}

export function setPersistence(app: App, persistence: Persistence): void {
	assertApp(app);
	assertInitializedAuth(app);
	assertPersistence(persistence);
	globalThis.localStorage.setItem(
		`baseless_${app.clientId}_persistence`,
		persistence,
	);
	const oldStorage = getStorage(app);
	const newStorage = persistence === "local"
		? globalThis.localStorage
		: globalThis.sessionStorage;
	const tokens = oldStorage?.getItem(`baseless_${app.clientId}_tokens`);
	if (tokens) {
		newStorage.setItem(`baseless_${app.clientId}_tokens`, tokens);
		oldStorage.removeItem(`baseless_${app.clientId}_tokens`);
	}
	storageMap.set(app.clientId, newStorage);
}

export function onAuthStateChange(
	app: App,
	listener: (identity: Identity | undefined) => void,
): () => void {
	assertApp(app);
	assertInitializedAuth(app);
	const onAuthStateChange = getOnAuthStateChange(app);
	return onAuthStateChange.listen(listener);
}

export async function getAuthenticationCeremony(
	app: App,
	state?: string,
): Promise<AuthenticationCeremonyResponse> {
	assertApp(app);
	assertInitializedAuth(app);
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
	return result.data;
}

export async function submitAuthenticationIdentification(
	app: App,
	type: string,
	identification: string,
	state?: string,
): Promise<AuthenticationCeremonyResponse> {
	assertApp(app);
	assertInitializedAuth(app);
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
		setTokens(app, result.data);
	}
	return result.data;
}

export async function submitAuthenticationChallenge(
	app: App,
	type: string,
	challenge: string,
	state: string,
): Promise<AuthenticationCeremonyResponse> {
	assertApp(app);
	assertInitializedAuth(app);
	const body = JSON.stringify({ type, challenge, state });
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/submitAuthenticationChallenge`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponse(result.data);
	if (isAuthenticationCeremonyResponseTokens(result.data)) {
		setTokens(app, result.data);
	}
	return result.data;
}

export async function sendIdentificationChallenge(
	app: App,
	type: string,
	state: string,
): Promise<SendIdentificationChallengeResponse> {
	assertApp(app);
	assertInitializedAuth(app);
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
	app: App,
	type: string,
	identification: string,
): Promise<SendIdentificationValidationCodeResponse> {
	assertApp(app);
	assertInitializedAuth(app);
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
	app: App,
	type: string,
	identification: string,
	code: string,
): Promise<ConfirmIdentificationValidationCodeResponse> {
	assertApp(app);
	assertInitializedAuth(app);
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

export async function signOut(app: App): Promise<void> {
	assertApp(app);
	assertInitializedAuth(app);
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/signOut`,
		{ method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	setTokens(app, undefined);
}

export function getIdToken(app: App): string | undefined {
	assertApp(app);
	assertInitializedAuth(app);
	const tokens = getTokens(app);
	return tokens?.id_token;
}

export async function createAnonymousIdentity(
	app: App,
): Promise<AuthenticationCeremonyResponseTokens> {
	assertApp(app);
	assertInitializedAuth(app);
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/createAnonymousIdentity`,
		{ method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	assertAuthenticationCeremonyResponseTokens(result.data);
	setTokens(app, result.data);
	return result.data;
}

export async function createIdentity(
	app: App,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	assertApp(app);
	assertInitializedAuth(app);
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
	app: App,
	identificationType: string,
	identification: string,
	locale: string,
): Promise<void> {
	assertApp(app);
	assertInitializedAuth(app);
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
	app: App,
	challengeType: string,
	challenge: string,
	locale: string,
): Promise<void> {
	assertApp(app);
	assertInitializedAuth(app);
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
	app: App,
	type: string,
): Promise<SendChallengeValidationCodeResponse> {
	assertApp(app);
	assertInitializedAuth(app);
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
	app: App,
	type: string,
	answer: string,
): Promise<ConfirmChallengeValidationCodeResponse> {
	assertApp(app);
	assertInitializedAuth(app);
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
