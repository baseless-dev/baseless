import type { AuthenticationCeremonyComponent } from "../ceremony.ts";
import { isAuthenticationCeremonyComponentChoice } from "./choice.ts";
import { oneOf, sequence } from "./helpers.ts";
import { isAuthenticationCeremonyComponentSequence } from "./sequence.ts";

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
