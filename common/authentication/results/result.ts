import { InvalidAuthenticationResultError } from "../errors.ts";
import {
	AuthenticationResultDone,
	isAuthenticationResultDone,
} from "./done.ts";
import {
	AuthenticationResultEncryptedState,
	isAuthenticationResultEncryptedState,
} from "./encrypted_state.ts";
import {
	AuthenticationResultError,
	isAuthenticationResultError,
} from "./error.ts";
import {
	AuthenticationResultRedirect,
	isAuthenticationResultRedirect,
} from "./redirect.ts";
import {
	AuthenticationResultState,
	isAuthenticationResultState,
} from "./state.ts";

export type AuthenticationResult =
	| AuthenticationResultDone
	| AuthenticationResultError
	| AuthenticationResultRedirect
	| AuthenticationResultState
	| AuthenticationResultEncryptedState;

export function isAuthenticationResult(
	value?: unknown,
): value is AuthenticationResult {
	return isAuthenticationResultDone(value) ||
		isAuthenticationResultError(value) ||
		isAuthenticationResultRedirect(value) ||
		isAuthenticationResultState(value) ||
		isAuthenticationResultEncryptedState(value);
}

export function assertAuthenticationResult(
	value?: unknown,
): asserts value is AuthenticationResult {
	if (!isAuthenticationResult(value)) {
		throw new InvalidAuthenticationResultError();
	}
}
