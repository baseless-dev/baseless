import {
	type AuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentChallenge,
	isAuthenticationCeremonyComponentIdentification,
} from "../ceremony.ts";
import { oneOf } from "./helpers.ts";
import walk, { type WalkedAuthenticationCeremonyComponent } from "./walk.ts";

export type NonSequenceAuthenticationCeremonyComponent =
	| WalkedAuthenticationCeremonyComponent
	| AuthenticationCeremonyComponentChoice;

export function getComponentAtPath(
	component: AuthenticationCeremonyComponent,
	path: string[],
): NonSequenceAuthenticationCeremonyComponent | undefined {
	const components = new Set<WalkedAuthenticationCeremonyComponent>();
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
