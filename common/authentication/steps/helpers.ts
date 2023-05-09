import { assertAuthenticationStep, AuthenticationStep } from "../step.ts";
import { AuthenticationChallenge } from "./challenge.ts";
import { AuthenticationConditional } from "./conditional.ts";
import { AuthenticationIdentification } from "./identification.ts";

export function sequence(...steps: AuthenticationStep[]) {
	for (const step of steps) {
		assertAuthenticationStep(step);
	}
	return { type: "sequence" as const, steps };
}

export function oneOf(...choices: AuthenticationStep[]) {
	for (const step of choices) {
		assertAuthenticationStep(step);
	}
	return { type: "choice" as const, choices };
}

export function iif(condition: AuthenticationConditional["condition"]) {
	return { type: "conditional" as const, condition };
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
