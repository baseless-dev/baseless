import { type AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidIdentityError } from "./errors.ts";
export const IDENTITY_AUTOID_PREFIX = "id_";

export type Identity = {
	id: AutoId;
	meta: Record<string, unknown>;
};

export function isIdentity(value: unknown): value is Identity {
	return !!value && typeof value === "object" && "id" in value &&
		isAutoId(value.id, IDENTITY_AUTOID_PREFIX) && "meta" in value &&
		typeof value.meta === "object";
}
export function assertIdentity(value: unknown): asserts value is Identity {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}
