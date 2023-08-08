import { isSchema } from "../../../schema/types.ts";
import {
	type AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentConditionalSchema,
	AuthenticationCeremonyComponentSequenceSchema,
} from "../ceremony.ts";

export function isLeaf(step: AuthenticationCeremonyComponent): boolean {
	if (isSchema(AuthenticationCeremonyComponentSequenceSchema, step)) {
		return step.components.every((step) =>
			!(isSchema(AuthenticationCeremonyComponentSequenceSchema, step) ||
				isSchema(AuthenticationCeremonyComponentChoiceSchema, step))
		);
	}
	if (isSchema(AuthenticationCeremonyComponentChoiceSchema, step)) {
		return step.components.every((step) =>
			!(isSchema(AuthenticationCeremonyComponentSequenceSchema, step) ||
				isSchema(AuthenticationCeremonyComponentChoiceSchema, step))
		);
	}
	if (isSchema(AuthenticationCeremonyComponentConditionalSchema, step)) {
		return false;
	}
	return true;
}
