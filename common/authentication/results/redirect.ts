import { InvalidAuthenticationResultRedirectError } from "../errors.ts";

export type AuthenticationResultRedirect = { done: false; redirect: URL };

export function isAuthenticationResultRedirect(
	value?: unknown,
): value is AuthenticationResultRedirect {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "redirect" in value &&
		value.redirect instanceof URL;
}

export function assertAuthenticationResultRedirect(
	value?: unknown,
): asserts value is AuthenticationResultRedirect {
	if (!isAuthenticationResultRedirect(value)) {
		throw new InvalidAuthenticationResultRedirectError();
	}
}
