import { type AuthenticationCeremonyComponent } from "../ceremony.ts";
import { oneOf, sequence } from "./helpers.ts";
import walk, { EOS } from "./walk.ts";

export function flatten(
	step: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	const branches: AuthenticationCeremonyComponent[] = [];
	for (const [comp, parents] of walk(step)) {
		if (comp === EOS) {
			branches.push(parents.length > 1 ? sequence(...parents) : parents[0]);
		}
	}
	if (branches.length > 1) {
		return oneOf(...branches);
	} else if (branches.length === 1) {
		return branches[0];
	}
	return step;
}
