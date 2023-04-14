import { AutoId } from "../../shared/autoid.ts";
import { Context } from "../context.ts";

export type AuthenticationStep =
	| AuthenticationIdentification
	| AuthenticationChallenge
	| AuthenticationSequence
	| AuthenticationChoice
	| AuthenticationConditional;

export type AuthenticationState = {
	readonly identity: AutoId;
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
	) {}
}

export abstract class AuthenticationIdenticator {
	/**
	 * Perform request authentication
	 * @param request The {@link Request}
	 * @param context The {@link Context}
	 * @param state The {@link AuthenticationState}
	 * @returns The {@link Identity.id} or a {@link Response} object
	 */
	abstract identify(
		request: Request,
		context: Context,
		state: AuthenticationState,
	): Promise<AutoId | Response>;

	/**
	 * If this identicator allows it, send a verification code
	 */
	abstract sendVerificationCode?: (
		request: Request,
		context: Context,
		identityId: AutoId,
	) => Promise<void>;
}

export class AuthenticationChallenge {
	constructor(
		public readonly type: string,
		public readonly icon: string,
		public readonly label: Record<string, string>,
		public readonly prompt: "password" | "otp",
	) {}
}

export abstract class AuthenticationChallenger {
	/**
	 * If need be, transform the challenge
	 */
	abstract transform?: (
		request: Request,
		context: Context,
		challenge: string,
	) => Promise<string>;

	/**
	 * Perform request challenge
	 * @param request The {@link Request}
	 * @param context The {@link Context}
	 * @param state The {@link AuthenticationState}
	 * @returns If the challenge was successful or not
	 */
	abstract challenge(
		request: Request,
		context: Context,
		state: AuthenticationState,
	): Promise<boolean>;
}

export class AuthenticationSequence {
	constructor(public readonly steps: ReadonlyArray<AuthenticationStep>) {}
	get type(): string {
		return `sequence(${this.steps.map((s) => s.type)})`;
	}
}

export function sequence(...steps: AuthenticationStep[]) {
	return new AuthenticationSequence(steps);
}

export class AuthenticationChoice {
	constructor(public readonly choices: ReadonlyArray<AuthenticationStep>) {}
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
			context: Context,
			state: AuthenticationState,
		) => AuthenticationStep | Promise<AuthenticationStep>,
	) {}
	get type(): string {
		return `condition()`;
	}
}

export function iif(condition: AuthenticationConditional["condition"]) {
	return new AuthenticationConditional(condition);
}

export async function simplify(
	step: AuthenticationStep,
): Promise<AuthenticationStep>;
export async function simplify(
	step: AuthenticationStep,
	request: Request,
	context: Context,
	state: AuthenticationState,
): Promise<AuthenticationStep>;
export async function simplify(
	step: AuthenticationStep,
	request?: Request,
	context?: Context,
	state?: AuthenticationState,
): Promise<AuthenticationStep> {
	if (step instanceof AuthenticationSequence) {
		const steps: AuthenticationStep[] = [];
		for (let inner of step.steps) {
			inner = await simplify(inner, request!, context!, state!);
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
			inner = await simplify(inner, request!, context!, state!);
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
			return simplify(result, request!, context!, state!);
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

export function unique(step: AuthenticationStep): AuthenticationStep[] {
	const steps = new Set<AuthenticationStep>();
	const walk = [step];

	while (walk.length) {
		const node = walk.shift()!;
		if (node instanceof AuthenticationSequence) {
			walk.unshift(...node.steps);
		} else if (node instanceof AuthenticationChoice) {
			walk.unshift(...node.choices);
		} else {
			steps.add(node);
		}
	}

	return Array.from(steps);
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
