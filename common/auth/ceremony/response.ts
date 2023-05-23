import { InvalidAuthenticationCeremonyResponseError } from "../errors.ts";
import {
	type AuthenticationCeremonyResponseDone,
	isAuthenticationCeremonyResponseDone,
} from "./response/done.ts";
import {
	type AuthenticationCeremonyResponseEncryptedState,
	isAuthenticationCeremonyResponseEncryptedState,
} from "./response/encrypted_state.ts";
import {
	type AuthenticationCeremonyResponseError,
	isAuthenticationCeremonyResponseError,
} from "./response/error.ts";
import {
	type AuthenticationCeremonyResponseRedirect,
	isAuthenticationCeremonyResponseRedirect,
} from "./response/redirect.ts";
import {
	type AuthenticationCeremonyResponseState,
	isAuthenticationCeremonyResponseState,
} from "./response/state.ts";
import {
	type AuthenticationCeremonyResponseTokens,
	isAuthenticationCeremonyResponseTokens,
} from "./response/tokens.ts";

export type AuthenticationCeremonyResponse =
	| AuthenticationCeremonyResponseDone
	| AuthenticationCeremonyResponseTokens
	| AuthenticationCeremonyResponseError
	| AuthenticationCeremonyResponseRedirect
	| AuthenticationCeremonyResponseState
	| AuthenticationCeremonyResponseEncryptedState;

export function isAuthenticationCeremonyResponse(
	value?: unknown,
): value is AuthenticationCeremonyResponse {
	return isAuthenticationCeremonyResponseDone(value) ||
		isAuthenticationCeremonyResponseTokens(value) ||
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
