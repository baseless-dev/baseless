import type { SessionData } from "../../common/session/data.ts";
import type { AuthenticationService } from "./auth.ts";
import type { IdentityService } from "./identity.ts";
import type { SessionService } from "./session.ts";

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
	readonly identity: IdentityService;
}
