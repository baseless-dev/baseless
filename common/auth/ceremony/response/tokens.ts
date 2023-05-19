import { InvalidAuthenticationCeremonyResponseTokensError } from "../../errors.ts";

export type AuthenticationCeremonyResponseTokens = {
	done: true;
	access_token: string;
	id_token: string;
	refresh_token?: string;
};

export function isAuthenticationCeremonyResponseTokens(
	value?: unknown,
): value is AuthenticationCeremonyResponseTokens {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && "access_token" in value &&
		typeof value.access_token === "string" &&
		"id_token" in value && typeof value.id_token === "string" &&
		(!("refresh_token" in value) || typeof value.refresh_token === "string");
}

export function assertAuthenticationCeremonyResponseTokens(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponseTokens {
	if (!isAuthenticationCeremonyResponseTokens(value)) {
		throw new InvalidAuthenticationCeremonyResponseTokensError();
	}
}
