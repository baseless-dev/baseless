import type { AuthenticationStep } from "../step.ts";
import { isAuthenticationChoice } from "./choice.ts";
import { oneOf } from "./helpers.ts";
import { isAuthenticationSequence } from "./sequence.ts";
import { simplify } from "./simplify.ts";

export class AuthenticationStepAtPathError extends Error { }

export type GetStepAtPathYieldResult = {
	done: false;
	step: AuthenticationStep;
};
export type GetStepAtPathReturnResult = { done: true };
export type GetStepAtPathResult =
	| GetStepAtPathYieldResult
	| GetStepAtPathReturnResult;

export function getStepAtPath(
	step: AuthenticationStep,
	path: string[],
): GetStepAtPathResult {
	if (isAuthenticationSequence(step)) {
		let i = 0;
		const stepLen = step.steps.length;
		const pathLen = path.length;
		for (; i < pathLen; ++i) {
			if (step.steps[i].type !== path[i]) {
				break;
			}
		}
		if (i === stepLen) {
			return { done: true };
		}
		if (i !== pathLen) {
			throw new AuthenticationStepAtPathError();
		}
		return { done: false, step: step.steps.at(i)! };
	} else if (isAuthenticationChoice(step)) {
		const nextSteps: GetStepAtPathResult[] = [];
		for (const inner of step.choices) {
			try {
				nextSteps.push(getStepAtPath(inner, path));
			} catch (_err) {
				// skip
			}
		}
		if (nextSteps.some((ns) => ns.done)) {
			return { done: true };
		}
		if (nextSteps.length === 1) {
			return nextSteps.at(0)!;
		} else if (nextSteps.length) {
			// const steps = nextSteps.filter((ns): ns is AuthStepNextValue => !ns.done).map((ns) => ns.next);
			const steps = nextSteps.reduce((steps, step) => {
				if (step.done === false) {
					steps.push(step.step);
				}
				return steps;
			}, [] as AuthenticationStep[]);
			return { done: false, step: simplify(oneOf(...new Set(steps))) };
		}
	} else if (path.length === 0) {
		return { done: false, step };
	} else if (step.type === path.at(0)!) {
		return { done: true };
	}
	throw new AuthenticationStepAtPathError();
}
