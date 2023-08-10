import {
	type AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentSequence,
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
		isAuthenticationCeremonyComponentSequence(component) ||
		isAuthenticationCeremonyComponentChoice(component)
	) {
		let changed = false;
		const componentsToReplace =
			isAuthenticationCeremonyComponentSequence(component)
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
			return isAuthenticationCeremonyComponentSequence(component)
				? sequence(...components)
				: oneOf(...components);
		}
	}
	return component;
}
