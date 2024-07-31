import { Type } from "@sinclair/typebox";
import { ID, isID } from "./id.ts";

export interface Session {
	sessionId: ID<"sess_">;
	identityId: ID<"id_">;
	data: Record<string, unknown>;
}

export const Session = Type.Object({
	sessionId: ID("sess_"),
	identityId: ID("id_"),
	data: Type.Record(Type.String(), Type.Unknown()),
}, { $id: "Session" });

export function isSession(value: unknown): value is Session {
	return !!value && typeof value === "object" && "sessionId" in value &&
		isID("sess_", value.sessionId) && "identityId" in value && isID("id_", value.identityId) &&
		"data" in value;
}

export function assertSession(value: unknown): asserts value is Session {
	if (!isSession(value)) {
		throw new InvalidSessionError();
	}
}

export class InvalidSessionError extends Error {}
