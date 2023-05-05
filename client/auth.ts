import { assertAuthenticationStep } from "../server/auth/flow.ts";
import {
	assertAuthenticationResult,
	assertGetStepResult,
	InvalidAuthenticationResultError,
	isAuthenticationResult,
	isAuthenticationResultEncryptedState,
} from "../server/services/auth.ts";
import { EventEmitter } from "../shared/eventemitter.ts";
import { App, assertApp } from "./app.ts";

// TODO move to server
export type Tokens = {
	id_token: string;
	access_token: string;
	refresh_token?: string;
};

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

const tokenMap = new Map<string, Tokens | undefined>();
const onAuthStateChangeMap = new Map<string, EventEmitter<never>>();
const storageMap = new Map<string, Storage>();

function assertInitializedAuth(app: App): asserts app is App {
	if (!tokenMap.has(app.clientId)) {
		throw new AuthNotInitializedError();
	}
}

function getAuthData(app: App) {
	assertApp(app);
	assertInitializedAuth(app);
	const tokens = tokenMap.get(app.clientId)!;
	const onAuthStateChange = onAuthStateChangeMap.get(app.clientId)!;
	const storage = storageMap.get(app.clientId)!;
	return { storage, tokens, onAuthStateChange };
}

export class AuthNotInitializedError extends Error {}

export function initializeAuth(app: App): App {
	assertApp(app);
	if (tokenMap.has(app.clientId)) {
		return app;
	}
	const persistence =
		globalThis.localStorage.getItem(`baseless_${app.clientId}_persistence`) ??
			"local";
	storageMap.set(
		app.clientId,
		persistence === "local"
			? globalThis.localStorage
			: globalThis.sessionStorage,
	);
	const onTokenChange = new EventEmitter<never>();
	onAuthStateChangeMap.set(app.clientId, onTokenChange);

	tokenMap.set(app.clientId, undefined);
	// TODO load tokens from storage
	// tokenMap.set(app.clientId, { ... });
	// TODO emit change in setTimeout to allow listeners to be added
	// setTimeout(() => onTokenChange.emit(), 0);
	return {
		...app,
		fetch(input: URL | Request | string, init?: RequestInit) {
			const headers = new Headers(init?.headers);
			const tokens = tokenMap.get(app.clientId);
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

export function setPersistence(app: App, persistence: Persistence) {
	assertApp(app);
	assertPersistence(persistence);
	const { storage } = getAuthData(app);
	globalThis.localStorage.setItem(
		`baseless_${app.clientId}_persistence`,
		persistence,
	);
	const newStorage = persistence === "local"
		? globalThis.localStorage
		: globalThis.sessionStorage;
	// TODO copy tokens from old storage to newStorage?
	storageMap.set(app.clientId, newStorage);
}

export function onAuthStateChange(app: App, listener: () => void) {
	assertApp(app);
	const { onAuthStateChange } = getAuthData(app);
	return onAuthStateChange.listen(listener);
}

export async function getAuthFlow(app: App) {
	assertApp(app);
	assertInitializedAuth(app);
	const resp = await app.fetch(`${app.apiEndpoint}/auth/flow`);
	const flow = await resp.json();
	// TODO error handling
	assertAuthenticationStep(flow);
	return flow;
}

export async function getSignInStep(app: App, state?: string) {
	assertApp(app);
	assertInitializedAuth(app);
	let method = "GET";
	let body: FormData | undefined;
	if (typeof state === "string") {
		method = "POST";
		body = new FormData();
		body.set("state", state);
	}
	const resp = await app.fetch(`${app.apiEndpoint}/auth/signInStep`, {
		body,
		method,
	});
	const result = await resp.json();
	// TODO error handling
	assertGetStepResult(result);
	return result;
}

export async function submitSignInIdentification(
	app: App,
	type: string,
	identification: string,
	state?: string,
) {
	assertApp(app);
	assertInitializedAuth(app);
	const body = new FormData();
	body.set("type", type);
	body.set("identification", identification);
	if (state) {
		body.set("state", state);
	}
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/signInSubmitIdentification`,
		{ body, method: "POST" },
	);
	const result = await resp.json();
	// TODO error handling
	if (
		!isAuthenticationResult(result) &&
		!isAuthenticationResultEncryptedState(result)
	) {
		throw new InvalidAuthenticationResultError();
	}
	return result;
}

export async function submitSignInChallenge(
	app: App,
	type: string,
	challenge: string,
	state: string,
) {
	assertApp(app);
	assertInitializedAuth(app);
	const body = new FormData();
	body.set("type", type);
	body.set("challenge", challenge);
	body.set("state", state);
	const resp = await app.fetch(
		`${app.apiEndpoint}/auth/signInSubmitChallenge`,
		{ body, method: "POST" },
	);
	const result = await resp.json();
	// TODO error handling
	if (
		!isAuthenticationResult(result) &&
		!isAuthenticationResultEncryptedState(result)
	) {
		throw new InvalidAuthenticationResultError();
	}
	return result;
}
