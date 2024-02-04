import type RegistrationService from "./registration.ts";

export interface Context {
	readonly remoteAddress: string;
	readonly registration: RegistrationService;
}
