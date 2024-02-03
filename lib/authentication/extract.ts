import type { AuthenticationCeremonyComponent } from "./types.ts";

export function extract(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent[] {
	if (component.kind === "sequence") {
		return Array.from(new Set(component.components.flatMap(extract)));
	} else if (component.kind === "choice") {
		return Array.from(new Set(component.components.flatMap(extract)));
	}
	return [component];
}
