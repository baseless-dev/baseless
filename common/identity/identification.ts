import { AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidIdentityIdentificationError } from "./errors.ts";

export interface IdentityIdentification<Meta = Record<string, unknown>> {
	readonly identityId: AutoId;
	readonly type: string;
	readonly identification: string;
	readonly verified: boolean;
	readonly meta: Meta;
}

export function isIdentityIdentification(
	value?: unknown,
): value is IdentityIdentification {
	return !!value && typeof value === "object" && "identityId" in value &&
		"type" in value && "identification" in value && "verified" in value &&
		"meta" in value && isAutoId(value.identityId) &&
		typeof value.verified === "boolean" && typeof value.meta === "object";
}

export function assertIdentityIdentification(
	value?: unknown,
): asserts value is IdentityIdentification {
	if (!isIdentityIdentification(value)) {
		throw new InvalidIdentityIdentificationError();
	}
}
