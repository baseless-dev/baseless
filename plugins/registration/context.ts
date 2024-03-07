import type RegistrationService from "./registration.ts";

export interface RegistrationContext {
	readonly remoteAddress: string;
	readonly registration: RegistrationService;
}
