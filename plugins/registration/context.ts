import type SessionService from "../authentication/session.ts";
import type RegistrationService from "./registration.ts";

export interface Context {
	readonly remoteAddress: string;
	readonly registration: RegistrationService;
	readonly session: SessionService;
}
