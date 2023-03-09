export interface OAuthConfiguration {
	readonly providerId: string;
	readonly providerLabel: string;
	readonly providerIcon: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly scope: string[];
	readonly authorizationEndpoint: string;
	readonly tokenEndpoint: string;
	readonly openIdEndpoint: string;
}

export interface OTPConfiguration {
	readonly providerId: string;
	readonly providerLabel: string;
}
export interface TOTPConfiguration {
	readonly providerId: string;
	readonly providerLabel: string;
}
export interface HOTPConfiguration {
	readonly providerId: string;
	readonly providerLabel: string;
}

export type Step =
	| { readonly type: "anonymous" }
	| { readonly type: "email" }
	| { readonly type: "password" }
	| { readonly type: "otp"; readonly config: OTPConfiguration }
	| { readonly type: "totp"; readonly config: TOTPConfiguration }
	| { readonly type: "hotp"; readonly config: HOTPConfiguration }
	| {
		readonly type: "oauth";
		readonly config: OAuthConfiguration;
	}
	| { readonly type: "chain"; steps: Step[] }
	| { readonly type: "oneOf"; steps: Step[] };

export function assertStep(value?: unknown): asserts value is Step {
	if (!value || typeof value !== "object" || !("type" in value) || typeof value.type !== "string") {
		throw new TypeError(`Value is not a valid step.`);
	}
}

export function chain(...steps: Step[]): Step {
	if (steps.length === 0) {
		throw new RangeError(`Expected at least one Step, got 0.`);
	}
	for (const step of steps) {
		assertStep(step);
	}
	return { type: "chain", steps };
}

export function oneOf(...steps: Step[]): Step {
	if (steps.length === 0) {
		throw new RangeError(`Expected at least one Step, got 0.`);
	}
	for (const step of steps) {
		assertStep(step);
	}
	return { type: "oneOf", steps };
}

export function anonymous(): Step {
	return { type: "anonymous" };
}

export function email(): Step {
	return { type: "email" };
}

export function password(): Step {
	return { type: "password" };
}

export function otp(config: OTPConfiguration): Step {
	return { type: "otp", config };
}

export function totp(config: TOTPConfiguration): Step {
	return { type: "totp", config };
}

export function hotp(config: HOTPConfiguration): Step {
	return { type: "hotp", config };
}

export function oauth(config: OAuthConfiguration): Step {
	return { type: "oauth", config };
}

export function stepPathIdentifier(step: Step) {
	if (step.type === "oauth" || step.type === "otp" || step.type === "totp" || step.type === "hotp") {
		return `${step.type}:${step.config.providerId}`;
	}
	return step.type;
}

export function nextStepAtPath(step: Step, path: string[] = []): IteratorResult<Step | undefined> {
	if (step.type === "oneOf") {
		const steps: Step[] = [];
		for (const inner of step.steps) {
			const nextStep = nextStepAtPath(inner, path);
			if (nextStep.done === true) {
				return nextStep;
			}
			if (nextStep.value) {
				steps.push(nextStep.value);
			}
		}
		if (steps.length === 1) {
			const value = steps.at(0)!;
			if (value.type === "oneOf") {
				return { done: false, value };
			}
			return { done: false, value: steps.at(0)! };
		}
		if (steps.length) {
			return { done: false, value: oneOf(...new Set(steps)) };
		}
		return { done: true, value: undefined };
	} else if (step.type === "chain") {
		let i = 0;
		for (const l = path.length, m = step.steps.length; i < l && i < m; ++i) {
			const inner = step.steps.at(i)!;
			if (stepPathIdentifier(inner) !== path[i]) {
				break;
			}
		}
		const nextStep = step.steps.at(i);
		if (nextStep) {
			return nextStepAtPath(nextStep, path.slice(1));
		}
		return { done: true, value: undefined };
	} else if (path.length === 0) {
		return { done: false, value: step };
	}
	return { done: false, value: undefined };
}
