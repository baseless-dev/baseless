import { InvalidAuthenticationChoiceError } from "../errors.ts";
import { AuthenticationStep, isAuthenticationStep } from "../step.ts";

export type AuthenticationChoice = {
	readonly type: "choice";
	readonly choices: ReadonlyArray<AuthenticationStep>;
};

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
