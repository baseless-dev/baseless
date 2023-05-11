import { InvalidAuthenticationCeremonyComponentError } from "./errors.ts";
import {
	AuthenticationCeremonyComponentChallenge,
	isAuthenticationCeremonyComponentChallenge,
} from "./component/challenge.ts";
import {
	AuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentChoice,
} from "./component/choice.ts";
import {
	AuthenticationCeremonyComponentConditional,
	isAuthenticationCeremonyComponentConditional,
} from "./component/conditional.ts";
import {
	AuthenticationCeremonyComponentIdentification,
	isAuthenticationCeremonyComponentIdentification,
} from "./component/identification.ts";
import {
	AuthenticationCeremonyComponentSequence,
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
