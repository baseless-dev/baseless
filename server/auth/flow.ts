import { AutoId } from "../../shared/autoid.ts";
import { Context } from "../context.ts";
import { createLogger } from "../logger.ts";
import { otp } from "./otp.ts";

export type AuthenticationStep = AuthenticationIdentification | AuthenticationChallenge | AuthenticationSequence | AuthenticationChoice;

export function isAuthenticationStep(value?: unknown): value is AuthenticationStep {
	return value instanceof AuthenticationIdentification || value instanceof AuthenticationChallenge || value instanceof AuthenticationSequence ||
		value instanceof AuthenticationChoice;
}

export function assertAuthenticationStep(value?: unknown): asserts value is AuthenticationStep {
	if (!isAuthenticationStep(value)) {
		throw new Error("Expected `value` to be an AuthenticationStep.");
	}
}

export abstract class AuthenticationIdentification {
	constructor(
		public readonly id: string,
		public readonly icon: string,
		public readonly label: Record<string, string>,
		public readonly prompt: "email" | "action",
	) { }

	abstract identify(request: Request, context: Context): Promise<AutoId | Response>;
}

export abstract class AuthenticationChallenge {
	constructor(
		public readonly id: string,
		public readonly icon: string,
		public readonly label: Record<string, string>,
		public readonly prompt: "password" | "otp",
	) { }
	sendInterval = 60;
	sendLimit = 1;
	send?: (request: Request, context: Context, identity: AutoId) => Promise<void>;
	abstract challenge(request: Request, context: Context, identity: AutoId): Promise<boolean | Response>;
}

export class AuthenticationSequence {
	constructor(public readonly steps: ReadonlyArray<AuthenticationStep>) { }
	get id(): string {
		return `sequence(${this.steps.map((s) => s.id)})`;
	}
}

export function sequence(...steps: AuthenticationStep[]) {
	return new AuthenticationSequence(steps);
}

export class AuthenticationChoice {
	constructor(public readonly choices: ReadonlyArray<AuthenticationStep>) { }
	get id(): string {
		return `choice(${this.choices.map((s) => s.id)})`;
	}
}

export function oneOf(...choices: AuthenticationStep[]) {
	return new AuthenticationChoice(choices);
}



export function simplify(step: AuthenticationStep): AuthenticationStep {
	if (step instanceof AuthenticationSequence) {
		const steps = step.steps.reduce((steps, step) => {
			step = simplify(step);
			if (step instanceof AuthenticationSequence) {
				steps.push(...step.steps);
			} else {
				steps.push(step);
			}
			return steps;
		}, [] as AuthenticationStep[]);
		return sequence(...steps);
	} else if (step instanceof AuthenticationChoice) {
		const choices = step.choices.reduce((choices, step) => {
			step = simplify(step);
			if (step instanceof AuthenticationChoice) {
				choices.push(...step.choices);
			} else {
				choices.push(step);
			}
			return choices;
		}, [] as AuthenticationStep[]);
		if (choices.length === 1) {
			return choices.at(0)!;
		}
		return oneOf(...choices);
	}
	return step;
}

export function replace(step: AuthenticationStep, search: AuthenticationStep, replacement: AuthenticationStep): AuthenticationStep {
	if (step === search) {
		return replacement;
	}
	if (step instanceof AuthenticationSequence || step instanceof AuthenticationChoice) {
		let changed = false;
		const stepsToReplace = step instanceof AuthenticationSequence ? step.steps : step.choices;
		const steps = stepsToReplace.map((step) => {
			const replaced = replace(step, search, replacement);
			if (replaced !== step) {
				changed = true;
			}
			return replaced;
		});
		if (changed) {
			return step instanceof AuthenticationSequence ? sequence(...steps) : oneOf(...steps);
		}
	}
	return step;
}

function isLeafAuthenticationStep(step: AuthenticationStep): boolean {
	if (!(step instanceof AuthenticationSequence || step instanceof AuthenticationChoice)) {
		return true;
	}
	if (step instanceof AuthenticationSequence && step.steps.every((step) => !(step instanceof AuthenticationSequence || step instanceof AuthenticationChoice))) {
		return true;
	}
	if (step instanceof AuthenticationChoice && step.choices.every((step) => !(step instanceof AuthenticationSequence || step instanceof AuthenticationChoice))) {
		return true;
	}
	return false;
}

export function flatten(step: AuthenticationStep): AuthenticationStep {
	const decomposed: AuthenticationStep[] = [];
	const trees: AuthenticationStep[] = [simplify(step)];

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
				if (node instanceof AuthenticationChoice) {
					trees.push(...node.choices.map((step) => replace(root, node, step)));
					forked = true;
				} else if (node instanceof AuthenticationSequence) {
					walk.unshift(...node.steps);
				} else {
					steps.push(node);
				}
			}
			if (!forked) {
				trees.push(root instanceof AuthenticationSequence ? sequence(...steps) : oneOf(...steps));
			}
		}
	}

	if (decomposed.length > 1) {
		return oneOf(...decomposed);
	}
	return decomposed.at(0)!;
}

export function* getNextIdentificationOrChallenge(step: AuthenticationStep): Generator<AuthenticationIdentification | AuthenticationChallenge> {
	if (step instanceof AuthenticationSequence) {
		yield* getNextIdentificationOrChallenge(step.steps.at(0)!);
	} else if (step instanceof AuthenticationChoice) {
		for (const inner of step.choices) {
			yield* getNextIdentificationOrChallenge(inner);
		}
	} else if (step) {
		yield step as AuthenticationIdentification | AuthenticationChallenge;
	}
}

export type NextAuthenticationStepResult =
	| { done: false; next: AuthenticationStep }
	| { done: true };

export class NextAuthenticationStepError extends Error { }

export function getNextAuthenticationStepAtPath(step: AuthenticationStep, path: string[]): NextAuthenticationStepResult {
	if (step instanceof AuthenticationSequence) {
		let i = 0;
		const stepLen = step.steps.length;
		const pathLen = path.length;
		for (; i < pathLen; ++i) {
			if (step.steps[i].id !== path[i]) {
				break;
			}
		}
		if (i === stepLen) {
			return { done: true };
		}
		if (i !== pathLen) {
			throw new NextAuthenticationStepError();
		}
		return { done: false, next: step.steps.at(i)! };
	} else if (step instanceof AuthenticationChoice) {
		const nextSteps: NextAuthenticationStepResult[] = [];
		for (const inner of step.choices) {
			try {
				nextSteps.push(getNextAuthenticationStepAtPath(inner, path));
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
					steps.push(step.next);
				}
				return steps;
			}, [] as AuthenticationStep[]);
			return { done: false, next: simplify(oneOf(...new Set(steps))) };
		}
	} else if (path.length === 0) {
		return { done: false, next: step };
	} else if (step.id === path.at(0)!) {
		return { done: true };
	}
	throw new NextAuthenticationStepError();
}
