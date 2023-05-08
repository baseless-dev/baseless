import { InvalidAuthenticationResultStateError } from "../errors.ts";
import { AuthenticationState, isAuthenticationState } from "../state.ts";

export type AuthenticationResultState = {
	state: AuthenticationState;
};

export function isAuthenticationResultState(
	value?: unknown,
): value is AuthenticationResultState {
	return !!value && typeof value === "object" && "state" in value && isAuthenticationState(value.state);
}

export function assertAuthenticationResultState(
	value?: unknown,
): asserts value is AuthenticationResultState {
	if (!isAuthenticationResultState(value)) {
		throw new InvalidAuthenticationResultStateError();
	}
}