import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

export function replace(
	component: AuthenticationCeremonyComponent,
	search: AuthenticationCeremonyComponent,
	replacement: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	if (component === search) {
		return replacement;
	}
	if (
		component.kind === "sequence" ||
		component.kind === "choice"
	) {
		let changed = false;
		const componentsToReplace = component.kind === "sequence"
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
			return component.kind === "sequence"
				? sequence(...components)
				: oneOf(...components);
		}
	}
	return component;
}
