import {
	assertAuthenticationCeremonyComponent,
	AuthenticationCeremonyComponent,
} from "../ceremony.ts";
import { AuthenticationCeremonyComponentChoice } from "./choice.ts";
import { AuthenticationCeremonyComponentConditional } from "./conditional.ts";
import { AuthenticationCeremonyComponentSequence } from "./sequence.ts";

export function sequence(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponentSequence {
	for (const step of components) {
		assertAuthenticationCeremonyComponent(step);
	}
	return { kind: "sequence", components };
}

export function oneOf(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponentChoice {
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
