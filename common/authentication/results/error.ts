import { InvalidAuthenticationResultErrorError } from "../errors.ts";

export type AuthenticationResultError = { done: false; error: true };

export function isAuthenticationResultError(
	value?: unknown,
): value is AuthenticationResultError {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "error" in value &&
		typeof value.error === "boolean";
}

export function assertAuthenticationResultError(
	value?: unknown,
): asserts value is AuthenticationResultError {
	if (!isAuthenticationResultError(value)) {
		throw new InvalidAuthenticationResultErrorError();
	}
}