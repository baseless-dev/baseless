import type { AuthenticationStep } from "../step.ts";
import { isAuthenticationChoice } from "./choice.ts";
import { oneOf, sequence } from "./helpers.ts";
import { isAuthenticationSequence } from "./sequence.ts";

export function replace(
	step: AuthenticationStep,
	search: AuthenticationStep,
	replacement: AuthenticationStep,
): AuthenticationStep {
	if (step === search) {
		return replacement;
	}
	if (
		isAuthenticationSequence(step) ||
		isAuthenticationChoice(step)
	) {
		let changed = false;
		const stepsToReplace = isAuthenticationSequence(step)
			? step.steps
			: step.choices;
		const steps = stepsToReplace.map((step) => {
			const replaced = replace(step, search, replacement);
			if (replaced !== step) {
				changed = true;
			}
			return replaced;
		});
		if (changed) {
			return isAuthenticationSequence(step)
				? sequence(...steps)
				: oneOf(...steps);
		}
	}
	return step;
}
