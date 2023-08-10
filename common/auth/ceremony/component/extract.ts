import {
	type AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentSequence,
} from "../ceremony.ts";

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
