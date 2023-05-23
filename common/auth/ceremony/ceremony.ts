import { InvalidAuthenticationCeremonyComponentError } from "../errors.ts";
import {
	type AuthenticationCeremonyComponentChallenge,
	isAuthenticationCeremonyComponentChallenge,
} from "./component/challenge.ts";
import {
	type AuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentChoice,
} from "./component/choice.ts";
import {
	type AuthenticationCeremonyComponentConditional,
	isAuthenticationCeremonyComponentConditional,
} from "./component/conditional.ts";
import {
	type AuthenticationCeremonyComponentIdentification,
	isAuthenticationCeremonyComponentIdentification,
} from "./component/identification.ts";
import {
	type AuthenticationCeremonyComponentSequence,
	isAuthenticationCeremonyComponentSequence,
} from "./component/sequence.ts";

export type AuthenticationCeremonyComponent =
	| AuthenticationCeremonyComponentIdentification
	| AuthenticationCeremonyComponentChallenge
	| AuthenticationCeremonyComponentSequence
	| AuthenticationCeremonyComponentChoice
	| AuthenticationCeremonyComponentConditional;

export function isAuthenticationCeremonyComponent(
	value?: unknown,
): value is AuthenticationCeremonyComponent {
	return isAuthenticationCeremonyComponentIdentification(value) ||
		isAuthenticationCeremonyComponentChallenge(value) ||
		isAuthenticationCeremonyComponentSequence(value) ||
		isAuthenticationCeremonyComponentChoice(value) ||
		isAuthenticationCeremonyComponentConditional(value);
}

export function assertAuthenticationCeremonyComponent(
	value?: unknown,
): asserts value is AuthenticationCeremonyComponent {
	if (!isAuthenticationCeremonyComponent(value)) {
		throw new InvalidAuthenticationCeremonyComponentError();
	}
}
