import { InvalidAuthenticationResultStateError } from "../errors.ts";
import { AuthenticationState, isAuthenticationState } from "../state.ts";
import { AuthenticationStep, isAuthenticationStep } from "../step.ts";

export type AuthenticationResultState = {
	state: AuthenticationState;
	done: false;
	step: AuthenticationStep;
	first: boolean;
	last: boolean;
};

export function isAuthenticationResultState(
	value?: unknown,
): value is AuthenticationResultState {
	return !!value && typeof value === "object" && "state" in value &&
		isAuthenticationState(value.state) && "done" in value &&
		typeof value.done === "boolean" &&
		"step" in value && isAuthenticationStep(value.step) && "first" in value &&
		typeof value.first === "boolean" &&
		"last" in value && typeof value.last === "boolean";
}

export function assertAuthenticationResultState(
	value?: unknown,
): asserts value is AuthenticationResultState {
	if (!isAuthenticationResultState(value)) {
		throw new InvalidAuthenticationResultStateError();
	}
}
