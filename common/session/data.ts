import { AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidSessionDataError } from "./errors.ts";

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
