import type { SessionData } from "../../lib/session/types.ts";
import type AuthenticationService from "./authentication.ts";

export type TokenData = {
	lastAuthorizationTime: number;
	scope: string[];
	sessionData: SessionData;
};

export interface AuthenticationContext {
	readonly remoteAddress: string;
	readonly authenticationToken: TokenData | undefined;
	readonly authentication: AuthenticationService;
}
