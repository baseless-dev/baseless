import { AutoId, isAutoId } from "../../system/autoid.ts";
import { InvalidAuthenticationResultDoneError } from "../errors.ts";

export type AuthenticationResultDone = { done: true; identityId: AutoId };

export function isAuthenticationResultDone(
	value?: unknown,
): value is AuthenticationResultDone {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && "identityId" in value && isAutoId(value.identityId);
}

export function assertAuthenticationResultDone(
	value?: unknown,
): asserts value is AuthenticationResultDone {
	if (!isAuthenticationResultDone(value)) {
		throw new InvalidAuthenticationResultDoneError();
	}
}
