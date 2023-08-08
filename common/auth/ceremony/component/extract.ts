import { isSchema } from "../../../schema/types.ts";
import {
	type AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentSequenceSchema,
} from "../ceremony.ts";

export function extract(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent[] {
	if (isSchema(AuthenticationCeremonyComponentSequenceSchema, component)) {
		return Array.from(new Set(component.components.flatMap(extract)));
	} else if (isSchema(AuthenticationCeremonyComponentChoiceSchema, component)) {
		return Array.from(new Set(component.components.flatMap(extract)));
	}
	return [component];
}
