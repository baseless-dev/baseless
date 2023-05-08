import type { AuthenticationStep } from "../step.ts";
import { isAuthenticationChoice } from "./choice.ts";
import { isAuthenticationConditional } from "./conditional.ts";
import { isAuthenticationSequence } from "./sequence.ts";

export function isLeaf(step: AuthenticationStep): boolean {
	if (isAuthenticationSequence(step)) {
		return step.steps.every((step) =>
			!(isAuthenticationSequence(step) || isAuthenticationChoice(step))
		);
	}
	if (isAuthenticationChoice(step)) {
		return step.choices.every((step) =>
			!(isAuthenticationSequence(step) || isAuthenticationChoice(step))
		);
	}
	if (isAuthenticationConditional(step)) {
		return false;
	}
	return true;
}