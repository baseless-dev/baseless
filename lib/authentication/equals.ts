import type { AuthenticationCeremonyComponent } from "./types.ts";

export default function equals(
	a: AuthenticationCeremonyComponent,
	b: AuthenticationCeremonyComponent,
): boolean {
	if (a.kind === "done" && b.kind === "done") {
		return true;
	} else if (
		a.kind === "choice" && b.kind === "choice" &&
		a.components.length === b.components.length
	) {
		return a.components.every((c, i) => equals(c, b.components[i]));
	} else if (
		a.kind === "sequence" && b.kind === "sequence" &&
		a.components.length === b.components.length
	) {
		return a.components.every((c, i) => equals(c, b.components[i]));
	} else if (a.kind === "prompt" && b.kind === "prompt" && a.id === b.id) {
		return true;
	}
	return false;
}
