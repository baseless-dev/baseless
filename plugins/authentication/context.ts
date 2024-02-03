import type { SessionData } from "../../lib/session/types.ts";
import type AuthenticationService from "./authentication.ts";
import type SessionService from "./session.ts";

export type TokenData = {
	lastAuthorizationTime: number;
	scope: string[];
	sessionData: SessionData;
};

export interface Context {
	readonly remoteAddress: string;
	readonly authenticationToken: TokenData | undefined;
	readonly auth: AuthenticationService;
	readonly session: SessionService;
}
