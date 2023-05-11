import type { AuthenticationCeremonyComponent } from "../ceremony.ts";
import { isAuthenticationCeremonyComponentChoice } from "./choice.ts";
import { isAuthenticationCeremonyComponentConditional } from "./conditional.ts";
import { isAuthenticationCeremonyComponentSequence } from "./sequence.ts";

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
