import type { AuthenticationCeremonyComponent } from "./types.ts";
import equals from "./equals.ts";

export function extract(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent[] {
	if (component.kind === "sequence" || component.kind === "choice") {
		const components = component.components.flatMap(extract);
		return components.filter((c, i) =>
			components.findIndex(equals.bind(null, c)) === i
		);
	}
	return [component];
}
