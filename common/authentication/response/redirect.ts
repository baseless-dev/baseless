import { InvalidAuthenticationResponseRedirectError } from "../errors.ts";

export type AuthenticationResponseRedirect = { done: false; redirect: URL };

export function isAuthenticationResponseRedirect(
	value?: unknown,
): value is AuthenticationResponseRedirect {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "redirect" in value &&
		value.redirect instanceof URL;
}

export function assertAuthenticationResponseRedirect(
	value?: unknown,
): asserts value is AuthenticationResponseRedirect {
	if (!isAuthenticationResponseRedirect(value)) {
		throw new InvalidAuthenticationResponseRedirectError();
	}
}
