import { AutoId, isAutoId } from "../../system/autoid.ts";
import { InvalidAuthenticationResponseDoneError } from "../errors.ts";

export type AuthenticationResponseDone = { done: true; identityId: AutoId };

export function isAuthenticationResponseDone(
	value?: unknown,
): value is AuthenticationResponseDone {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && "identityId" in value && isAutoId(value.identityId);
}

export function assertAuthenticationResponseDone(
	value?: unknown,
): asserts value is AuthenticationResponseDone {
	if (!isAuthenticationResponseDone(value)) {
		throw new InvalidAuthenticationResponseDoneError();
	}
}
