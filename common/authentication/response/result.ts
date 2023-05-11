import { InvalidAuthenticationResponseError } from "../errors.ts";
import {
	AuthenticationResponseDone,
	isAuthenticationResponseDone,
} from "./done.ts";
import {
	AuthenticationResponseEncryptedState,
	isAuthenticationResponseEncryptedState,
} from "./encrypted_state.ts";
import {
	AuthenticationResponseError,
	isAuthenticationResponseError,
} from "./error.ts";
import {
	AuthenticationResponseRedirect,
	isAuthenticationResponseRedirect,
} from "./redirect.ts";
import {
	AuthenticationResponseState,
	isAuthenticationResponseState,
} from "./state.ts";

export type AuthenticationResponse =
	| AuthenticationResponseDone
	| AuthenticationResponseError
	| AuthenticationResponseRedirect
	| AuthenticationResponseState
	| AuthenticationResponseEncryptedState;

export function isAuthenticationResponse(
	value?: unknown,
): value is AuthenticationResponse {
	return isAuthenticationResponseDone(value) ||
		isAuthenticationResponseError(value) ||
		isAuthenticationResponseRedirect(value) ||
		isAuthenticationResponseState(value) ||
		isAuthenticationResponseEncryptedState(value);
}

export function assertAuthenticationResponse(
	value?: unknown,
): asserts value is AuthenticationResponse {
	if (!isAuthenticationResponse(value)) {
		throw new InvalidAuthenticationResponseError();
	}
}
