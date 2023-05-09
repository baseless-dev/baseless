import { InvalidAuthenticationResultEncryptedStateError } from "../errors.ts";
import { AuthenticationStep, isAuthenticationStep } from "../step.ts";

export type AuthenticationResultEncryptedState = {
	encryptedState: string;
	done: false;
	step: AuthenticationStep;
	first: boolean;
	last: boolean;
};

export function isAuthenticationResultEncryptedState(
	value?: unknown,
): value is AuthenticationResultEncryptedState {
	return !!value && typeof value === "object" && "encryptedState" in value &&
		typeof value.encryptedState === "string" && "done" in value &&
		typeof value.done === "boolean" &&
		"step" in value && isAuthenticationStep(value.step) && "first" in value &&
		typeof value.first === "boolean" &&
		"last" in value && typeof value.last === "boolean";
}

export function assertAuthenticationResultEncryptedState(
	value?: unknown,
): asserts value is AuthenticationResultEncryptedState {
	if (!isAuthenticationResultEncryptedState(value)) {
		throw new InvalidAuthenticationResultEncryptedStateError();
	}
}
