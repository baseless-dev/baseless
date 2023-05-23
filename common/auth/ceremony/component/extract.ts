import type { AuthenticationCeremonyComponent } from "../ceremony.ts";
import { isAuthenticationCeremonyComponentChoice } from "./choice.ts";
import { isAuthenticationCeremonyComponentSequence } from "./sequence.ts";

export function extract(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent[] {
	if (isAuthenticationCeremonyComponentSequence(component)) {
		return Array.from(new Set(component.components.flatMap(extract)));
	} else if (isAuthenticationCeremonyComponentChoice(component)) {
		return Array.from(new Set(component.components.flatMap(extract)));
	}
	return [component];
}
