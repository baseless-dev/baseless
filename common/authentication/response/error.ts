import { InvalidAuthenticationResponseErrorError } from "../errors.ts";

export type AuthenticationResponseError = { done: false; error: true };

export function isAuthenticationResponseError(
	value?: unknown,
): value is AuthenticationResponseError {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "error" in value &&
		typeof value.error === "boolean";
}

export function assertAuthenticationResponseError(
	value?: unknown,
): asserts value is AuthenticationResponseError {
	if (!isAuthenticationResponseError(value)) {
		throw new InvalidAuthenticationResponseErrorError();
	}
}
