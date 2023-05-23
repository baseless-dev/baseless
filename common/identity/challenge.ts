import { type AutoId, isAutoId } from "../system/autoid.ts";
import { InvalidIdentityChallengeError } from "./errors.ts";
import { IDENTITY_AUTOID_PREFIX } from "./identity.ts";

export interface IdentityChallenge<Meta = Record<string, unknown>> {
	readonly identityId: AutoId;
	readonly type: string;
	readonly meta: Meta;
}

export function isIdentityChallenge(
	value?: unknown,
): value is IdentityChallenge {
	return !!value && typeof value === "object" && "identityId" in value &&
		"type" in value && "meta" in value &&
		isAutoId(value.identityId, IDENTITY_AUTOID_PREFIX) &&
		typeof value.meta === "object";
}

export function assertIdentityChallenge(
	value?: unknown,
): asserts value is IdentityChallenge {
	if (!isIdentityChallenge(value)) {
		throw new InvalidIdentityChallengeError();
	}
}
