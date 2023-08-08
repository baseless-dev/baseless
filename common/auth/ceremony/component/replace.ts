import { isSchema } from "../../../schema/types.ts";
import {
	type AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentSequenceSchema,
} from "../ceremony.ts";
import { oneOf, sequence } from "./helpers.ts";

export function replace(
	component: AuthenticationCeremonyComponent,
	search: AuthenticationCeremonyComponent,
	replacement: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	if (component === search) {
		return replacement;
	}
	if (
		isSchema(AuthenticationCeremonyComponentSequenceSchema, component) ||
		isSchema(AuthenticationCeremonyComponentChoiceSchema, component)
	) {
		let changed = false;
		const componentsToReplace =
			isSchema(AuthenticationCeremonyComponentSequenceSchema, component)
				? component.components
				: component.components;
		const components = componentsToReplace.map((component) => {
			const replaced = replace(component, search, replacement);
			if (replaced !== component) {
				changed = true;
			}
			return replaced;
		});
		if (changed) {
			return isSchema(AuthenticationCeremonyComponentSequenceSchema, component)
				? sequence(...components)
				: oneOf(...components);
		}
	}
	return component;
}
