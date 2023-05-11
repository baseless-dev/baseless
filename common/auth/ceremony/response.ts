import { InvalidAuthenticationCeremonyResponseError } from "../errors.ts";
import {
	AuthenticationCeremonyResponseDone,
	isAuthenticationCeremonyResponseDone,
} from "./response/done.ts";
import {
	AuthenticationCeremonyResponseEncryptedState,
	isAuthenticationCeremonyResponseEncryptedState,
} from "./response/encrypted_state.ts";
import {
	AuthenticationCeremonyResponseError,
	isAuthenticationCeremonyResponseError,
} from "./response/error.ts";
import {
	AuthenticationCeremonyResponseRedirect,
	isAuthenticationCeremonyResponseRedirect,
} from "./response/redirect.ts";
import {
	AuthenticationCeremonyResponseState,
	isAuthenticationCeremonyResponseState,
} from "./response/state.ts";

export type AuthenticationCeremonyResponse =
	| AuthenticationCeremonyResponseDone
	| AuthenticationCeremonyResponseError
	| AuthenticationCeremonyResponseRedirect
	| AuthenticationCeremonyResponseState
	| AuthenticationCeremonyResponseEncryptedState;

export function isAuthenticationCeremonyResponse(
	value?: unknown,
): value is AuthenticationCeremonyResponse {
	return isAuthenticationCeremonyResponseDone(value) ||
		isAuthenticationCeremonyResponseError(value) ||
		isAuthenticationCeremonyResponseRedirect(value) ||
		isAuthenticationCeremonyResponseState(value) ||
		isAuthenticationCeremonyResponseEncryptedState(value);
}

export function assertAuthenticationCeremonyResponse(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponse {
	if (!isAuthenticationCeremonyResponse(value)) {
		throw new InvalidAuthenticationCeremonyResponseError();
	}
}