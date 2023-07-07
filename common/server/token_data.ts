import type { SessionData } from "../session/data.ts";

export type TokenData<Meta = Record<string, unknown>> = {
	lastAuthorizationTime: number;
	scope: string[];
	sessionData: SessionData<Meta>;
};
