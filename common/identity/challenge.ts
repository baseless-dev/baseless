import { type AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidIdentityChallengeError } from "./errors.ts";
import { IDENTITY_AUTOID_PREFIX } from "./identity.ts";

export type IdentityChallenge = {
	identityId: AutoId;
	type: string;
	confirmed: boolean;
	meta: Record<string, unknown>;
};

export function isIdentityChallenge(
	value: unknown,
): value is IdentityChallenge {
	return !!value && typeof value === "object" && "identityId" in value &&
		isAutoId(value.identityId, IDENTITY_AUTOID_PREFIX) && "type" in value &&
		typeof value.type === "string" && "confirmed" in value &&
		typeof value.confirmed === "boolean" && "meta" in value &&
		typeof value.meta === "object";
}
export function assertIdentityChallenge(
	value: unknown,
): asserts value is IdentityChallenge {
	if (!isIdentityChallenge(value)) {
		throw new InvalidIdentityChallengeError();
	}
}
