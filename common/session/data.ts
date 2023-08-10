import { IDENTITY_AUTOID_PREFIX } from "../identity/identity.ts";
import { type AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidSessionDataError } from "./errors.ts";

export const SESSION_AUTOID_PREFIX = "ses-";

export type SessionData = {
	id: AutoId;
	identityId: AutoId;
	meta: Record<string, unknown>;
};

export function isSessionData(value?: unknown): value is SessionData {
	return !!value && typeof value === "object" && "id" in value &&
		"identityId" in value && "meta" in value &&
		isAutoId(value.id, SESSION_AUTOID_PREFIX) &&
		isAutoId(value.identityId, IDENTITY_AUTOID_PREFIX) &&
		typeof value.meta === "object";
}

export function assertSessionData(
	value?: unknown,
): asserts value is SessionData {
	if (!isSessionData(value)) {
		throw new InvalidSessionDataError();
	}
}
