import { AutoId, isAutoId } from "../../shared/autoid.ts";

export type SessionData<Meta = Record<string, unknown>> = {
	id: AutoId;
	identityId: AutoId;
	meta: Meta;
};

export function isSessionData(value?: unknown): value is SessionData {
	return !!value && typeof value === "object" && "id" in value &&
		"identityId" in value && "meta" in value && isAutoId(value.id) &&
		isAutoId(value.identityId) && typeof value.meta === "object";
}

export function assertSessionData(
	value?: unknown,
): asserts value is SessionData {
	if (!isSessionData(value)) {
		throw new InvalidSessionDataError();
	}
}

export interface SessionProvider {
	get<Meta extends Record<string, unknown>>(
		sessionId: AutoId,
	): Promise<SessionData<Meta>>;
	create(
		identityId: AutoId,
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<SessionData>;
	update(sessionData: SessionData): Promise<void>;
	destroy(sessionId: AutoId): Promise<void>;
	list(identityId: AutoId): Promise<SessionData[]>;
}

export class InvalidSessionDataError extends Error {}
