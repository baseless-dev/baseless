import { InvalidAuthenticationCeremonyResponseTokensError } from "../../errors.ts";
import { AuthenticationTokens, isAuthenticationTokens } from "../../tokens.ts";

export type AuthenticationCeremonyResponseTokens = {
	done: true;
} & AuthenticationTokens;

export function isAuthenticationCeremonyResponseTokens(
	value?: unknown,
): value is AuthenticationCeremonyResponseTokens {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && isAuthenticationTokens(value);
}

export function assertAuthenticationCeremonyResponseTokens(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponseTokens {
	if (!isAuthenticationCeremonyResponseTokens(value)) {
		throw new InvalidAuthenticationCeremonyResponseTokensError();
	}
}
