import {
	type AuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponentSequence,
	isAuthenticationCeremonyComponentChallenge,
	isAuthenticationCeremonyComponentIdentification,
} from "../ceremony.ts";
import { oneOf } from "./helpers.ts";
import walk from "./walk.ts";

export type NonSequenceAuthenticationCeremonyComponent = Exclude<
	AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentSequence
>;

export function getComponentAtPath(
	component: AuthenticationCeremonyComponent,
	path: string[],
): NonSequenceAuthenticationCeremonyComponent | undefined {
	const components = new Set<NonSequenceAuthenticationCeremonyComponent>();
	const joinedPath = path.join("/");
	for (const [comp, parents] of walk(component)) {
		const currentPath = parents.map((c) => {
			if (
				isAuthenticationCeremonyComponentIdentification(c) ||
				isAuthenticationCeremonyComponentChallenge(c)
			) {
				return c.id;
			}
		}).filter(Boolean).join("/");
		if (currentPath === joinedPath) {
			components.add(comp);
		}
	}
	if (components.size === 1) {
		return Array.from(components)[0];
	} else if (components.size > 1) {
		return oneOf(...components);
	}
}
