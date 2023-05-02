import { AutoId, isAutoId } from "../../shared/autoid.ts";
import { Context } from "../context.ts";

export type AuthenticationIdentification = {
	readonly type: string;
	readonly icon: string;
	readonly label: Record<string, string>;
	readonly prompt: "email" | "action";
};

export type AuthenticationChallenge = {
	readonly type: string;
	readonly icon: string;
	readonly label: Record<string, string>;
	readonly prompt: "password" | "otp";
};

export type AuthenticationSequence = {
	readonly type: "sequence";
	readonly steps: ReadonlyArray<AuthenticationStep>;
};

export type AuthenticationChoice = {
	readonly type: "choice";
	readonly choices: ReadonlyArray<AuthenticationStep>;
};

export type AuthenticationConditional = {
	readonly type: "conditional";
	readonly condition: (
		context: Context,
		state: AuthenticationState,
	) => AuthenticationStep | Promise<AuthenticationStep>;
};

export type AuthenticationStep =
	| AuthenticationIdentification
	| AuthenticationChallenge
	| AuthenticationSequence
	| AuthenticationChoice
	| AuthenticationConditional;

export function isAuthenticationIdentification(
	value?: unknown,
): value is AuthenticationIdentification {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && "icon" in value &&
		typeof value.icon === "string" && "label" in value &&
		typeof value.label === "object" && "prompt" in value &&
		typeof value.prompt === "string" &&
		["email", "action"].includes(value.prompt);
}

export function assertAuthenticationIdentification(
	value?: unknown,
): asserts value is AuthenticationIdentification {
	if (!isAuthenticationIdentification(value)) {
		throw new InvalidAuthenticationIdentificationError();
	}
}

export class InvalidAuthenticationIdentificationError extends Error {}

export function isAuthenticationChallenge(
	value?: unknown,
): value is AuthenticationChallenge {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && "icon" in value &&
		typeof value.icon === "string" && "label" in value &&
		typeof value.label === "object" && "prompt" in value &&
		typeof value.prompt === "string" &&
		["password", "otp"].includes(value.prompt);
}

export function assertAuthenticationChallenge(
	value?: unknown,
): asserts value is AuthenticationChallenge {
	if (!isAuthenticationChallenge(value)) {
		throw new InvalidAuthenticationChallengeError();
	}
}

export class InvalidAuthenticationChallengeError extends Error {}

export function isAuthenticationSequence(
	value?: unknown,
): value is AuthenticationSequence {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && value.type === "sequence" &&
		"steps" in value && Array.isArray(value.steps) &&
		value.steps.every((s) => isAuthenticationStep(s));
}

export function assertAuthenticationSequence(
	value?: unknown,
): asserts value is AuthenticationSequence {
	if (!isAuthenticationSequence(value)) {
		throw new InvalidAuthenticationSequenceError();
	}
}

export class InvalidAuthenticationSequenceError extends Error {}

export function isAuthenticationChoice(
	value?: unknown,
): value is AuthenticationChoice {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && value.type === "choice" &&
		"choices" in value && Array.isArray(value.choices) &&
		value.choices.every((s) => isAuthenticationStep(s));
}

export function assertAuthenticationChoice(
	value?: unknown,
): asserts value is AuthenticationChoice {
	if (!isAuthenticationChoice(value)) {
		throw new InvalidAuthenticationChoiceError();
	}
}

export class InvalidAuthenticationChoiceError extends Error {}

export function isAuthenticationConditional(
	value?: unknown,
): value is AuthenticationConditional {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && value.type === "conditional" &&
		"condition" in value && typeof value.condition === "function";
}

export function assertAuthenticationConditional(
	value?: unknown,
): asserts value is AuthenticationConditional {
	if (!isAuthenticationConditional(value)) {
		throw new InvalidAuthenticationConditionalError();
	}
}

export class InvalidAuthenticationConditionalError extends Error {}

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

export class InvalidAuthenticationStepError extends Error {}

export type AuthenticationStateAnonymous = {
	readonly choices: string[];
};

export type AuthenticationStateIdentified = {
	readonly identity: AutoId;
	readonly choices: string[];
};

export type AuthenticationState =
	| AuthenticationStateAnonymous
	| AuthenticationStateIdentified;

export function isAuthenticationStateAnonymous(
	value?: unknown,
): value is AuthenticationStateAnonymous {
	return typeof value === "object" && value !== null && "choices" in value &&
		Array.isArray(value.choices) &&
		value.choices.every((c) => typeof c === "string");
}

export function assertAuthenticationStateAnonymous(
	value?: unknown,
): asserts value is AuthenticationStateAnonymous {
	if (!isAuthenticationStateAnonymous(value)) {
		throw new Error("Expected `value` to be an AuthenticationStateAnonymous.");
	}
}

export function isAuthenticationStateIdentified(
	value?: unknown,
): value is AuthenticationStateIdentified {
	return isAuthenticationStateAnonymous(value) && "identity" in value &&
		isAutoId(value.identity);
}

export function assertAuthenticationStateIdentified(
	value?: unknown,
): asserts value is AuthenticationStateIdentified {
	if (!isAuthenticationStateIdentified(value)) {
		throw new Error("Expected `value` to be an AuthenticationStateIdentified.");
	}
}

export function isAuthenticationState(
	value?: unknown,
): value is AuthenticationState {
	return isAuthenticationStateAnonymous(value) ||
		isAuthenticationStateIdentified(value);
}

export function assertAuthenticationState(
	value?: unknown,
): asserts value is AuthenticationState {
	if (!isAuthenticationState(value)) {
		throw new Error("Expected `value` to be an AuthenticationState.");
	}
}

export function sequence(...steps: AuthenticationStep[]) {
	return { type: "sequence" as const, steps };
}

export function oneOf(...choices: AuthenticationStep[]) {
	return { type: "choice" as const, choices };
}

export function iif(condition: AuthenticationConditional["condition"]) {
	return { type: "conditional" as const, condition };
}

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

export function email(
	{ icon, label }: { icon: string; label: Record<string, string> },
): AuthenticationIdentification {
	return { type: "email", icon, label, prompt: "email" };
}

export function password(
	{ icon, label }: { icon: string; label: Record<string, string> },
): AuthenticationChallenge {
	return { type: "password", icon, label, prompt: "password" };
}

export function action(
	{ type, icon, label }: {
		type: string;
		icon: string;
		label: Record<string, string>;
	},
): AuthenticationIdentification {
	return { type, icon, label, prompt: "action" };
}

export function otp(
	{ type, icon, label }: {
		type: string;
		icon: string;
		label: Record<string, string>;
	},
): AuthenticationChallenge {
	return { type, icon, label, prompt: "otp" };
}

function isLeafAuthenticationStep(step: AuthenticationStep): boolean {
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

export function flatten(step: AuthenticationStep): AuthenticationStep {
	const decomposed: AuthenticationStep[] = [];
	const trees: AuthenticationStep[] = [step];

	while (trees.length) {
		const root = trees.shift()!;
		if (isLeafAuthenticationStep(root)) {
			decomposed.push(root);
		} else {
			let forked = false;
			const steps: AuthenticationStep[] = [];
			const walk: AuthenticationStep[] = [root];
			while (walk.length) {
				const node = walk.shift()!;
				if (isAuthenticationChoice(node)) {
					trees.push(...node.choices.map((step) => replace(root, node, step)));
					forked = true;
				} else if (isAuthenticationSequence(node)) {
					walk.unshift(...node.steps);
				} else {
					steps.push(node);
				}
			}
			if (!forked) {
				trees.push(
					isAuthenticationSequence(root) ? sequence(...steps) : oneOf(...steps),
				);
			}
		}
	}

	if (decomposed.length > 1) {
		return oneOf(...decomposed);
	}
	return decomposed.at(0)!;
}

export class AuthenticationStepAtPathError extends Error {}

export type GetAuthenticationStepAtPathYieldResult = {
	done: false;
	step: AuthenticationStep;
};
export type GetAuthenticationStepAtPathReturnResult = { done: true };
export type GetStepResult =
	| GetAuthenticationStepAtPathYieldResult
	| GetAuthenticationStepAtPathReturnResult;

export function getAuthenticationStepAtPath(
	step: AuthenticationStep,
	path: string[],
): GetStepResult {
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
		const nextSteps: GetStepResult[] = [];
		for (const inner of step.choices) {
			try {
				nextSteps.push(getAuthenticationStepAtPath(inner, path));
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
