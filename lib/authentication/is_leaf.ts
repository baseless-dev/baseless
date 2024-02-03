import type { AuthenticationCeremonyComponent } from "./types.ts";

export function isLeaf(step: AuthenticationCeremonyComponent): boolean {
	if (step.kind === "sequence") {
		return step.components.every((step) =>
			!(step.kind === "sequence" || step.kind === "choice")
		);
	}
	if (step.kind === "choice") {
		return step.components.every((step) =>
			!(step.kind === "sequence" || step.kind === "choice")
		);
	}
	return true;
}
