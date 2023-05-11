import { InvalidAuthenticationResponseEncryptedStateError } from "../errors.ts";
import {
	AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony.ts";

export type AuthenticationResponseEncryptedState = {
	encryptedState: string;
	done: false;
	component: AuthenticationCeremonyComponent;
	first: boolean;
	last: boolean;
};

export function isAuthenticationResponseEncryptedState(
	value?: unknown,
): value is AuthenticationResponseEncryptedState {
	return !!value && typeof value === "object" && "encryptedState" in value &&
		typeof value.encryptedState === "string" && "done" in value &&
		typeof value.done === "boolean" &&
		"component" in value &&
		isAuthenticationCeremonyComponent(value.component) && "first" in value &&
		typeof value.first === "boolean" &&
		"last" in value && typeof value.last === "boolean";
}

export function assertAuthenticationResponseEncryptedState(
	value?: unknown,
): asserts value is AuthenticationResponseEncryptedState {
	if (!isAuthenticationResponseEncryptedState(value)) {
		throw new InvalidAuthenticationResponseEncryptedStateError();
	}
}
