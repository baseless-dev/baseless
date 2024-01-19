import type { IAuthenticationService } from "../../common/services/auth.ts";
import type { ISessionService } from "../../common/services/session.ts";
import type { IIdentityService } from "../../common/services/identity.ts";
import type { SessionData } from "../../common/session/data.ts";

export type TokenData = {
	lastAuthorizationTime: number;
	scope: string[];
	sessionData: SessionData;
};

export interface Context {
	readonly remoteAddress: string;
	readonly authenticationToken: TokenData | undefined;
	readonly auth: IAuthenticationService;
	readonly session: ISessionService;
	readonly identity: IIdentityService;
}
