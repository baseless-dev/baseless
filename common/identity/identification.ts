import { type AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidIdentityIdentificationError } from "./errors.ts";
import { IDENTITY_AUTOID_PREFIX } from "./identity.ts";

export interface IdentityIdentification<Meta = Record<string, unknown>> {
	readonly identityId: AutoId;
	readonly type: string;
	readonly identification: string;
	readonly confirmed: boolean;
	readonly meta: Meta;
}

export function isIdentityIdentification(
	value?: unknown,
): value is IdentityIdentification {
	return !!value && typeof value === "object" && "identityId" in value &&
		"type" in value && "identification" in value && "confirmed" in value &&
		"meta" in value && isAutoId(value.identityId, IDENTITY_AUTOID_PREFIX) &&
		typeof value.confirmed === "boolean" && typeof value.meta === "object";
}

export function assertIdentityIdentification(
	value?: unknown,
): asserts value is IdentityIdentification {
	if (!isIdentityIdentification(value)) {
		throw new InvalidIdentityIdentificationError();
	}
}
