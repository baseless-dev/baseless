import { InvalidAuthenticationCeremonyResponseStateError } from "../../errors.ts";
import {
	AuthenticationCeremonyState,
	isAuthenticationCeremonyState,
} from "../state.ts";
import {
	AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony.ts";

export type AuthenticationCeremonyResponseState = {
	state: AuthenticationCeremonyState;
	done: false;
	component: AuthenticationCeremonyComponent;
	first: boolean;
	last: boolean;
};

export function isAuthenticationCeremonyResponseState(
	value?: unknown,
): value is AuthenticationCeremonyResponseState {
	return !!value && typeof value === "object" && "state" in value &&
		isAuthenticationCeremonyState(value.state) && "done" in value &&
		typeof value.done === "boolean" &&
		"component" in value &&
		isAuthenticationCeremonyComponent(value.component) && "first" in value &&
		typeof value.first === "boolean" &&
		"last" in value && typeof value.last === "boolean";
}

export function assertAuthenticationCeremonyResponseState(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponseState {
	if (!isAuthenticationCeremonyResponseState(value)) {
		throw new InvalidAuthenticationCeremonyResponseStateError();
	}
}
