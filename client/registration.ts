import { Assert } from "../deps.ts";
import {
	type RegistrationCeremonyState,
	RegistrationCeremonyStateSchema,
} from "../lib/registration/types.ts";
import { type App, isApp } from "./app.ts";
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
