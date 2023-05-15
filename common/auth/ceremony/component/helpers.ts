import {
	assertAuthenticationCeremonyComponent,
	AuthenticationCeremonyComponent,
} from "../ceremony.ts";
import { AuthenticationCeremonyComponentChallenge } from "./challenge.ts";
import { AuthenticationCeremonyComponentChoice } from "./choice.ts";
import { AuthenticationCeremonyComponentConditional } from "./conditional.ts";
import { AuthenticationCeremonyComponentIdentification } from "./identification.ts";
import { AuthenticationCeremonyComponentSequence } from "./sequence.ts";

export function sequence(...components: AuthenticationCeremonyComponent[]): AuthenticationCeremonyComponentSequence {
	for (const step of components) {
		assertAuthenticationCeremonyComponent(step);
	}
	return { kind: "sequence", components };
}

export function oneOf(...components: AuthenticationCeremonyComponent[]): AuthenticationCeremonyComponentChoice {
	for (const step of components) {
		assertAuthenticationCeremonyComponent(step);
	}
	return { kind: "choice", components };
}

export function iif(
	condition: AuthenticationCeremonyComponentConditional["condition"],
): AuthenticationCeremonyComponentConditional {
	return { kind: "conditional", condition };
}

export function email(): AuthenticationCeremonyComponentIdentification {
	return { kind: "email", prompt: "email" };
}

export function password(): AuthenticationCeremonyComponentChallenge {
	return { kind: "password", prompt: "password" };
}

export function action(
	{ kind }: { kind: string; },
): AuthenticationCeremonyComponentIdentification {
	return { kind, prompt: "action" };
}

export function otp(
	{ kind }: { kind: string; },
): AuthenticationCeremonyComponentChallenge {
	return { kind, prompt: "otp" };
}
