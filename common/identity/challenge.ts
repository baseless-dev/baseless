import { InvalidIdentityChallengeError } from "./errors.ts";

export type IdentityChallenge = {
	type: string;
	confirmed: boolean;
	meta: Record<string, unknown>;
};

export function isIdentityChallenge(
	value: unknown,
): value is IdentityChallenge {
	return !!value && typeof value === "object" && "type" in value &&
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
