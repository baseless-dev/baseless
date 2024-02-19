import equals from "./equals.ts";
import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

export function simplify(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	if (component.kind === "sequence" || component.kind === "choice") {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (inner.kind === component.kind) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		const uniqueComponents = components.filter((c, i) =>
			components.findIndex(equals.bind(null, c)) === i
		);
		if (uniqueComponents.length === 1) {
			return uniqueComponents[0];
		}
		return component.kind === "sequence"
			? sequence(...uniqueComponents)
			: oneOf(...uniqueComponents);
	}
	return component;
}
