import { InvalidAuthenticationResultEncryptedStateError } from "../errors.ts";

export type AuthenticationResultEncryptedState = {
	encryptedState: string;
};

export function isAuthenticationResultEncryptedState(
	value?: unknown,
): value is AuthenticationResultEncryptedState {
	return !!value && typeof value === "object" && "encryptedState" in value &&
		typeof value.encryptedState === "string";
}

export function assertAuthenticationResultEncryptedState(
	value?: unknown,
): asserts value is AuthenticationResultEncryptedState {
	if (!isAuthenticationResultEncryptedState(value)) {
		throw new InvalidAuthenticationResultEncryptedStateError();
	}
}
