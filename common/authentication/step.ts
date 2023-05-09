import { InvalidAuthenticationStepError } from "./errors.ts";
import {
	AuthenticationChallenge,
	isAuthenticationChallenge,
} from "./steps/challenge.ts";
import {
	AuthenticationChoice,
	isAuthenticationChoice,
} from "./steps/choice.ts";
import {
	AuthenticationConditional,
	isAuthenticationConditional,
} from "./steps/conditional.ts";
import {
	AuthenticationIdentification,
	isAuthenticationIdentification,
} from "./steps/identification.ts";
import {
	AuthenticationSequence,
	isAuthenticationSequence,
} from "./steps/sequence.ts";

export type AuthenticationStep =
	| AuthenticationIdentification
	| AuthenticationChallenge
	| AuthenticationSequence
	| AuthenticationChoice
	| AuthenticationConditional;

export function isAuthenticationStep(
	value?: unknown,
): value is AuthenticationStep {
	return isAuthenticationIdentification(value) ||
		isAuthenticationChallenge(value) || isAuthenticationSequence(value) ||
		isAuthenticationChoice(value) || isAuthenticationConditional(value);
}

export function assertAuthenticationStep(
	value?: unknown,
): asserts value is AuthenticationStep {
	if (!isAuthenticationStep(value)) {
		throw new InvalidAuthenticationStepError();
	}
}
