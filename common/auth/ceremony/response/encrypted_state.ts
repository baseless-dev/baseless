import { InvalidAuthenticationCeremonyResponseEncryptedStateError } from "../../errors.ts";
import {
	type AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony.ts";

export type AuthenticationCeremonyResponseEncryptedState = {
	encryptedState: string;
	done: false;
	component: AuthenticationCeremonyComponent;
	first: boolean;
	last: boolean;
};

export function isAuthenticationCeremonyResponseEncryptedState(
	value?: unknown,
): value is AuthenticationCeremonyResponseEncryptedState {
	return !!value && typeof value === "object" && "encryptedState" in value &&
		typeof value.encryptedState === "string" && "done" in value &&
		typeof value.done === "boolean" &&
		"component" in value &&
		isAuthenticationCeremonyComponent(value.component) && "first" in value &&
		typeof value.first === "boolean" &&
		"last" in value && typeof value.last === "boolean";
}

export function assertAuthenticationCeremonyResponseEncryptedState(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponseEncryptedState {
	if (!isAuthenticationCeremonyResponseEncryptedState(value)) {
		throw new InvalidAuthenticationCeremonyResponseEncryptedStateError();
	}
}
