import {
	type AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentConditional,
	isAuthenticationCeremonyComponentSequence,
} from "../ceremony.ts";

export function isLeaf(step: AuthenticationCeremonyComponent): boolean {
	if (isAuthenticationCeremonyComponentSequence(step)) {
		return step.components.every((step) =>
			!(isAuthenticationCeremonyComponentSequence(step) ||
				isAuthenticationCeremonyComponentChoice(step))
		);
	}
	if (isAuthenticationCeremonyComponentChoice(step)) {
		return step.components.every((step) =>
			!(isAuthenticationCeremonyComponentSequence(step) ||
				isAuthenticationCeremonyComponentChoice(step))
		);
	}
	if (isAuthenticationCeremonyComponentConditional(step)) {
		return false;
	}
	return true;
}
