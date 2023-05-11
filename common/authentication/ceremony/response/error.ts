import { InvalidAuthenticationCeremonyResponseErrorError } from "../../errors.ts";

export type AuthenticationCeremonyResponseError = { done: false; error: true };

export function isAuthenticationCeremonyResponseError(
	value?: unknown,
): value is AuthenticationCeremonyResponseError {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "error" in value &&
		typeof value.error === "boolean";
}

export function assertAuthenticationCeremonyResponseError(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponseError {
	if (!isAuthenticationCeremonyResponseError(value)) {
		throw new InvalidAuthenticationCeremonyResponseErrorError();
	}
}
