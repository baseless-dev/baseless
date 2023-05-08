import { InvalidAuthenticationSequenceError } from "../errors.ts";
import { AuthenticationStep, isAuthenticationStep } from "../step.ts";

export type AuthenticationSequence = {
	readonly type: "sequence";
	readonly steps: ReadonlyArray<AuthenticationStep>;
};

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
