import {
	type AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentSequence,
} from "../ceremony.ts";
import { oneOf, sequence } from "./helpers.ts";

export function simplify(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	if (isAuthenticationCeremonyComponentSequence(component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (isAuthenticationCeremonyComponentSequence(inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		return sequence(...components);
	} else if (isAuthenticationCeremonyComponentChoice(component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (isAuthenticationCeremonyComponentChoice(inner)) {
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
