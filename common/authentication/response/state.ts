import { InvalidAuthenticationResponseStateError } from "../errors.ts";
import {
	AuthenticationCeremonyState,
	isAuthenticationCeremonyState,
} from "../ceremony/state.ts";
import {
	AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony/ceremony.ts";

export type AuthenticationResponseState = {
	state: AuthenticationCeremonyState;
	done: false;
	component: AuthenticationCeremonyComponent;
	first: boolean;
	last: boolean;
};

export function isAuthenticationResponseState(
	value?: unknown,
): value is AuthenticationResponseState {
	return !!value && typeof value === "object" && "state" in value &&
		isAuthenticationCeremonyState(value.state) && "done" in value &&
		typeof value.done === "boolean" &&
		"component" in value &&
		isAuthenticationCeremonyComponent(value.component) && "first" in value &&
		typeof value.first === "boolean" &&
		"last" in value && typeof value.last === "boolean";
}

export function assertAuthenticationResponseState(
	value?: unknown,
): asserts value is AuthenticationResponseState {
	if (!isAuthenticationResponseState(value)) {
		throw new InvalidAuthenticationResponseStateError();
	}
}
