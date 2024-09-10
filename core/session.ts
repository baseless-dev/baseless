import { type ID, isID } from "./id.ts";

export interface Session {
	sessionId?: ID<"sid_">;
	identityId: ID<"id_">;
	scope: string[];
	aat: number;
}

export function isSession(value: unknown): value is Session {
	return !!value && typeof value === "object" &&
		(!("sessionId" in value) || ("sessionId" in value && isID("sid_", value.sessionId))) &&
		"identityId" in value && isID("id_", value.identityId) && "scope" in value &&
		Array.isArray(value.scope) && value.scope.every((s) => typeof s === "string") &&
		"aat" in value && typeof value.aat === "number";
}

export function assertSession(value: unknown): asserts value is Session {
	if (!isSession(value)) {
		throw new InvalidSessionError();
	}
}

export class InvalidSessionError extends Error {}
