import { Assert, Value } from "../deps.ts";
import {
	type RegistrationCeremonyState,
	RegistrationCeremonyStateSchema,
	RegistrationSendValidationCodeResult,
	RegistrationSendValidationCodeResultSchema,
	RegistrationSubmitResult,
	RegistrationSubmitResultSchema,
	RegistrationSubmitState,
	RegistrationSubmitStateDoneSchema,
	RegistrationSubmitStateSchema,
} from "../lib/registration/types.ts";
import { type App, isApp } from "./app.ts";
import { unsafe_getAuthentication } from "./authentication.ts";
import { throwIfApiError } from "./errors.ts";

export class RegistrationApp {
	#app: App;
	#apiEndpoint: string;

	constructor(app: App, apiEndpoint: string) {
		this.#app = app;
		this.#apiEndpoint = apiEndpoint;
	}

	get apiEndpoint(): string {
		return this.#apiEndpoint;
	}
}

const registrationApps = new Map<App["clientId"], RegistrationApp>();
function getRegistration(app: App): RegistrationApp {
	assertInitializedRegistration(app);
	return registrationApps.get(app.clientId)!;
}

export class RegistrationNotInitializedError extends Error {}

export function assertInitializedRegistration(
	value?: unknown,
): asserts value is App {
	if (!isApp(value) || !registrationApps.has(value.clientId)) {
		throw new RegistrationNotInitializedError();
	}
}

export function initializeRegistration(app: App, apiEndpoint: string): App {
	if (!registrationApps.has(app.clientId)) {
		const auth = new RegistrationApp(app, apiEndpoint);
		registrationApps.set(app.clientId, auth);
	}

	return app;
}

export async function getCeremony(
	app: App,
	state?: string,
): Promise<RegistrationCeremonyState> {
	assertInitializedRegistration(app);
	const register = getRegistration(app);
	let method = "GET";
	let body: string | undefined;
	const headers = new Headers();
	if (typeof state === "string") {
		method = "POST";
		headers.set("Content-Type", "application/json");
		body = JSON.stringify({ state });
	}
	const resp = await app.fetch(
		`${register.apiEndpoint}/ceremony`,
		{
			body,
			method,
		},
	);
	const result = await resp.json();
	throwIfApiError(result);
	Assert(RegistrationCeremonyStateSchema, result.data);
	return result.data;
}

export async function submitPrompt(
	app: App,
	component: string,
	prompt: unknown,
	state?: string,
): Promise<RegistrationSubmitState> {
	assertInitializedRegistration(app);
	const register = getRegistration(app);
	const body = JSON.stringify({
		component,
		prompt,
		...(state ? { state } : undefined),
	});
	const resp = await app.fetch(
		`${register.apiEndpoint}/submit-prompt`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	Assert(RegistrationSubmitStateSchema, result.data);
	if (Value.Check(RegistrationSubmitStateDoneSchema, result.data)) {
		const { access_token, id_token, refresh_token } = result.data;
		unsafe_getAuthentication(app).tokens = {
			access_token,
			id_token,
			refresh_token,
		};
	}
	return result.data;
}

export async function sendValidationCode(
	app: App,
	component: string,
	locale: string,
	state?: string,
): Promise<RegistrationSendValidationCodeResult> {
	assertInitializedRegistration(app);
	const register = getRegistration(app);
	const body = JSON.stringify({
		component,
		locale,
		...(state ? { state } : undefined),
	});
	const resp = await app.fetch(
		`${register.apiEndpoint}/send-validation-code`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	Assert(RegistrationSendValidationCodeResultSchema, result.data);
	return result.data;
}

export async function submitValidationCode(
	app: App,
	component: string,
	code: string,
	state?: string,
): Promise<RegistrationSubmitState> {
	assertInitializedRegistration(app);
	const register = getRegistration(app);
	const body = JSON.stringify({
		component,
		code,
		...(state ? { state } : undefined),
	});
	const resp = await app.fetch(
		`${register.apiEndpoint}/submit-validation-code`,
		{ body, headers: { "Content-Type": "application/json" }, method: "POST" },
	);
	const result = await resp.json();
	throwIfApiError(result);
	Assert(RegistrationSubmitStateSchema, result.data);
	if (Value.Check(RegistrationSubmitStateDoneSchema, result.data)) {
		const { access_token, id_token, refresh_token } = result.data;
		unsafe_getAuthentication(app).tokens = {
			access_token,
			id_token,
			refresh_token,
		};
	}
	return result.data;
}
