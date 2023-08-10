import {
	assertAuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponentChoice,
	type AuthenticationCeremonyComponentConditional,
	type AuthenticationCeremonyComponentSequence,
} from "../ceremony.ts";
export * as h from "./helpers.ts";

export function sequence(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponentSequence {
	for (const component of components) {
		assertAuthenticationCeremonyComponent(component);
	}
	return { kind: "sequence", components };
}

export function oneOf(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponentChoice {
	for (const component of components) {
		assertAuthenticationCeremonyComponent(component);
	}
	return { kind: "choice", components };
}

export function iif(
	condition: AuthenticationCeremonyComponentConditional["condition"],
): AuthenticationCeremonyComponentConditional {
	return { kind: "conditional", condition };
}
