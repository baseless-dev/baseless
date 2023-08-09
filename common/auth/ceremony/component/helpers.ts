import { assertSchema } from "../../../schema/types.ts";
import {
	type AuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponentChoice,
	type AuthenticationCeremonyComponentConditional,
	AuthenticationCeremonyComponentSchema,
	type AuthenticationCeremonyComponentSequence,
} from "../ceremony.ts";
export * as h from "./helpers.ts";

export function sequence(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponentSequence {
	for (const component of components) {
		assertSchema(AuthenticationCeremonyComponentSchema, component);
	}
	return { kind: "sequence", components };
}

export function oneOf(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponentChoice {
	for (const component of components) {
		assertSchema(AuthenticationCeremonyComponentSchema, component);
	}
	return { kind: "choice", components };
}

export function iif(
	condition: AuthenticationCeremonyComponentConditional["condition"],
): AuthenticationCeremonyComponentConditional {
	return { kind: "conditional", condition };
}
