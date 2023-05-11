import { InvalidAuthenticationCeremonyResponseRedirectError } from "../../errors.ts";

export type AuthenticationCeremonyResponseRedirect = {
	done: false;
	redirect: URL;
};

export function isAuthenticationCeremonyResponseRedirect(
	value?: unknown,
): value is AuthenticationCeremonyResponseRedirect {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === false && "redirect" in value &&
		value.redirect instanceof URL;
}

export function assertAuthenticationCeremonyResponseRedirect(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponseRedirect {
	if (!isAuthenticationCeremonyResponseRedirect(value)) {
		throw new InvalidAuthenticationCeremonyResponseRedirectError();
	}
}
