import type { SessionData } from "../session/data.ts";

export type TokenData = {
	lastAuthorizationTime: number;
	scope: string[];
	sessionData: SessionData;
};
