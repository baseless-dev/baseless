import { AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidIdentityError } from "./errors.ts";

export const IDENTITY_AUTOID_PREFIX = "id-";

export interface Identity<Meta = Record<string, unknown>> {
	readonly id: AutoId;
	readonly meta: Meta;
}

export function isIdentity(value?: unknown): value is Identity {
	return !!value && typeof value === "object" && "id" in value &&
		"meta" in value && isAutoId(value.id, IDENTITY_AUTOID_PREFIX) &&
		typeof value.meta === "object";
}

export function assertIdentity(value?: unknown): asserts value is Identity {
	if (!isIdentity(value)) {
		throw new InvalidIdentityError();
	}
}
