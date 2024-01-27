import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

export function simplify(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	if (component.kind === "sequence") {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (inner.kind === "sequence") {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		return sequence(...components);
	} else if (component.kind === "choice") {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (inner.kind === "choice") {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		if (components.length === 1) {
			return components.at(0)!;
		}
		return oneOf(...components);
	}
	return component;
}
