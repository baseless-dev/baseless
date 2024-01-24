import {
	type AuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentEqual,
	isAuthenticationCeremonyComponentPrompt,
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
			if (isAuthenticationCeremonyComponentPrompt(c)) {
				return c.id;
			}
		}).filter(Boolean).join("/");
		if (currentPath === joinedPath) {
			components.add(comp);
		}
	}
	const uniqueComponents = Array.from(components).filter((c, i, a) =>
		a.findIndex((o) => isAuthenticationCeremonyComponentEqual(o, c)) === i
	);
	if (uniqueComponents.length === 1) {
		return uniqueComponents[0];
	} else if (uniqueComponents.length > 1) {
		return oneOf(...uniqueComponents);
	}
}
