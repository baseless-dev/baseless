import { AutoId } from "../../shared/autoid.ts";
import { NonExtendableContext } from "../context.ts";

export type AuthenticationStep =
	| AuthenticationIdentification
	| AuthenticationChallenge
	| AuthenticationSequence
	| AuthenticationChoice
	| AuthenticationConditional;

export type AuthenticationState = {
	readonly identity?: AutoId;
	readonly choices: string[];
};

export function isAuthenticationStep(
	value?: unknown,
): value is AuthenticationStep {
	return value instanceof AuthenticationIdentification ||
		value instanceof AuthenticationChallenge ||
		value instanceof AuthenticationSequence ||
		value instanceof AuthenticationChoice ||
		value instanceof AuthenticationConditional;
}

export function assertAuthenticationStep(
	value?: unknown,
): asserts value is AuthenticationStep {
	if (!isAuthenticationStep(value)) {
		throw new Error("Expected `value` to be an AuthenticationStep.");
	}
}

export class AuthenticationIdentification {
	constructor(
		public readonly type: string,
		public readonly icon: string,
		public readonly label: Record<string, string>,
		public readonly prompt: "email" | "action",
	) { }
}

export abstract class AuthenticationIdenticator {
	abstract identify(
		request: Request,
		context: NonExtendableContext,
		state: AuthenticationState,
	): Promise<AutoId | Response>;

	// /**
	//  * If this identicator allows it, send a verification code
	//  */
	// abstract sendVerificationCode?: (
	// 	request: Request,
	// 	context: Context,
	// 	identityId: AutoId,
	// ) => Promise<void>;
}

export class AuthenticationChallenge {
	constructor(
		public readonly type: string,
		public readonly icon: string,
		public readonly label: Record<string, string>,
		public readonly prompt: "password" | "otp",
	) { }
}

export abstract class AuthenticationChallenger {
	// /**
	//  * If need be, transform the challenge
	//  */
	// abstract transform?: (
	// 	request: Request,
	// 	context: Context,
	// 	challenge: string,
	// ) => Promise<string>;

	// /**
	//  * Perform request challenge
	//  * @param request The {@link Request}
	//  * @param context The {@link Context}
	//  * @param state The {@link AuthenticationState}
	//  * @returns If the challenge was successful or not
	//  */
	// abstract challenge(
	// 	request: Request,
	// 	context: Context,
	// 	state: AuthenticationState,
	// ): Promise<boolean>;
}

export class AuthenticationSequence {
	constructor(public readonly steps: ReadonlyArray<AuthenticationStep>) { }
	get type(): string {
		return `sequence(${this.steps.map((s) => s.type)})`;
	}
}

export function sequence(...steps: AuthenticationStep[]) {
	return new AuthenticationSequence(steps);
}

export class AuthenticationChoice {
	constructor(public readonly choices: ReadonlyArray<AuthenticationStep>) { }
	get type(): string {
		return `choice(${this.choices.map((s) => s.type)})`;
	}
}

export function oneOf(...choices: AuthenticationStep[]) {
	return new AuthenticationChoice(choices);
}

export class AuthenticationConditional {
	constructor(
		public readonly condition: (
			request: Request,
			context: NonExtendableContext,
			state: AuthenticationState,
		) => AuthenticationStep | Promise<AuthenticationStep>,
	) { }
	get type(): string {
		return `condition()`;
	}
}

export function iif(condition: AuthenticationConditional["condition"]) {
	return new AuthenticationConditional(condition);
}

export function simplify(
	step: AuthenticationStep,
): AuthenticationStep {
	if (step instanceof AuthenticationSequence) {
		const steps: AuthenticationStep[] = [];
		for (let inner of step.steps) {
			inner = simplify(inner);
			if (inner instanceof AuthenticationSequence) {
				steps.push(...inner.steps);
			} else {
				steps.push(inner);
			}
		}
		return sequence(...steps);
	} else if (step instanceof AuthenticationChoice) {
		const choices: AuthenticationStep[] = [];
		for (let inner of step.choices) {
			inner = simplify(inner);
			if (inner instanceof AuthenticationChoice) {
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
	request: Request,
	context: NonExtendableContext,
	state: AuthenticationState,
): Promise<AuthenticationStep> {
	if (step instanceof AuthenticationSequence) {
		const steps: AuthenticationStep[] = [];
		for (let inner of step.steps) {
			inner = await simplifyWithContext(inner, request, context, state);
			if (inner instanceof AuthenticationSequence) {
				steps.push(...inner.steps);
			} else {
				steps.push(inner);
			}
		}
		return sequence(...steps);
	} else if (step instanceof AuthenticationChoice) {
		const choices: AuthenticationStep[] = [];
		for (let inner of step.choices) {
			inner = await simplifyWithContext(inner, request, context, state);
			if (inner instanceof AuthenticationChoice) {
				choices.push(...inner.choices);
			} else {
				choices.push(inner);
			}
		}
		if (choices.length === 1) {
			return choices.at(0)!;
		}
		return oneOf(...choices);
	} else if (step instanceof AuthenticationConditional) {
		if (request && context && state) {
			const result = await step.condition(request, context, state);
			return simplifyWithContext(result, request, context, state);
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
		step instanceof AuthenticationSequence ||
		step instanceof AuthenticationChoice
	) {
		let changed = false;
		const stepsToReplace = step instanceof AuthenticationSequence
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
			return step instanceof AuthenticationSequence
				? sequence(...steps)
				: oneOf(...steps);
		}
	}
	return step;
}

export function email(
	{ icon, label }: { icon: string; label: Record<string, string> },
) {
	return new AuthenticationIdentification("email", icon, label, "email");
}

export function password(
	{ icon, label }: { icon: string; label: Record<string, string> },
) {
	return new AuthenticationChallenge("password", icon, label, "password");
}

export function action(
	{ type, icon, label }: {
		type: string;
		icon: string;
		label: Record<string, string>;
	},
) {
	return new AuthenticationIdentification(type, icon, label, "action");
}

export function otp(
	{ type, icon, label }: {
		type: string;
		icon: string;
		label: Record<string, string>;
	},
) {
	return new AuthenticationChallenge(type, icon, label, "otp");
}

function isLeafAuthenticationStep(step: AuthenticationStep): boolean {
	if (step instanceof AuthenticationSequence) {
		return step.steps.every((step) =>
			!(step instanceof AuthenticationSequence ||
				step instanceof AuthenticationChoice)
		);
	}
	if (step instanceof AuthenticationChoice) {
		return step.choices.every((step) =>
			!(step instanceof AuthenticationSequence ||
				step instanceof AuthenticationChoice)
		);
	}
	if (step instanceof AuthenticationConditional) {
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
				trees.push(
					root instanceof AuthenticationSequence
						? sequence(...steps)
						: oneOf(...steps),
				);
			}
		}
	}

	if (decomposed.length > 1) {
		return oneOf(...decomposed);
	}
	return decomposed.at(0)!;
}

export class AuthenticationStepAtPathError extends Error { }

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
	if (step instanceof AuthenticationSequence) {
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
	} else if (step instanceof AuthenticationChoice) {
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
