import type { Context } from "../../../server/context.ts";
import type { AuthenticationState } from "../state.ts";
import type { AuthenticationStep } from "../step.ts";
import { isAuthenticationChoice } from "./choice.ts";
import { isAuthenticationConditional } from "./conditional.ts";
import { oneOf, sequence } from "./helpers.ts";
import { isAuthenticationSequence } from "./sequence.ts";

export function simplify(
	step: AuthenticationStep,
): AuthenticationStep {
	if (isAuthenticationSequence(step)) {
		const steps: AuthenticationStep[] = [];
		for (let inner of step.steps) {
			inner = simplify(inner);
			if (isAuthenticationSequence(inner)) {
				steps.push(...inner.steps);
			} else {
				steps.push(inner);
			}
		}
		return sequence(...steps);
	} else if (isAuthenticationChoice(step)) {
		const choices: AuthenticationStep[] = [];
		for (let inner of step.choices) {
			inner = simplify(inner);
			if (isAuthenticationChoice(inner)) {
				choices.push(...inner.choices);
			} else {
				choices.push(inner);
			}
		}
		if (choices.length === 1) {
			return choices.at(0)!;
		}
		return oneOf(...choices);
	}
	return step;
}

export async function simplifyWithContext(
	step: AuthenticationStep,
	context: Context,
	state: AuthenticationState,
): Promise<AuthenticationStep> {
	if (isAuthenticationSequence(step)) {
		const steps: AuthenticationStep[] = [];
		for (let inner of step.steps) {
			inner = await simplifyWithContext(inner, context, state);
			if (isAuthenticationSequence(inner)) {
				steps.push(...inner.steps);
			} else {
				steps.push(inner);
			}
		}
		return sequence(...steps);
	} else if (isAuthenticationChoice(step)) {
		const choices: AuthenticationStep[] = [];
		for (let inner of step.choices) {
			inner = await simplifyWithContext(inner, context, state);
			if (isAuthenticationChoice(inner)) {
				choices.push(...inner.choices);
			} else {
				choices.push(inner);
			}
		}
		if (choices.length === 1) {
			return choices.at(0)!;
		}
		return oneOf(...choices);
	} else if (isAuthenticationConditional(step)) {
		if (context && state) {
			const result = await step.condition(context, state);
			return simplifyWithContext(result, context, state);
		}
	}
	return step;
}