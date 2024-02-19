import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

export function map(
	component: AuthenticationCeremonyComponent,
	mapper: (
		component: AuthenticationCeremonyComponent,
	) => undefined | AuthenticationCeremonyComponent,
): undefined | AuthenticationCeremonyComponent {
	if (component.kind === "sequence" || component.kind === "choice") {
		const components: AuthenticationCeremonyComponent[] = [];
		for (const inner of component.components) {
			const mapped = map(inner, mapper);
			if (mapped) {
				const result = mapper(mapped);
				if (result) {
					components.push(result);
				}
			}
		}
		if (components.length === 0) {
			return undefined;
		}
		return component.kind === "sequence"
			? sequence(...components)
			: oneOf(...components);
	}
	return mapper(component);
}
