import { InvalidAuthenticationTokensError } from "./errors.ts";

export type AuthenticationTokens = {
	access_token: string;
	id_token: string;
	refresh_token?: string;
};

export function isAuthenticationTokens(
	value?: unknown,
): value is AuthenticationTokens {
	return !!value && typeof value === "object" && "access_token" in value &&
		typeof value.access_token === "string" &&
		"id_token" in value && typeof value.id_token === "string" &&
		(!("refresh_token" in value) || typeof value.refresh_token === "string");
}

export function assertAuthenticationTokens(
	value?: unknown,
): asserts value is AuthenticationTokens {
	if (!isAuthenticationTokens(value)) {
		throw new InvalidAuthenticationTokensError();
	}
}
