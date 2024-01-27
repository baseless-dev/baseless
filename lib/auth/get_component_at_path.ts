import {
	type AtPathAuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponent,
	oneOf,
	type WalkedAuthenticationCeremonyComponent,
} from "./types.ts";
import walk from "./walk.ts";

export function getComponentAtPath(
	component: AuthenticationCeremonyComponent,
	path: string[],
): AtPathAuthenticationCeremonyComponent | undefined {
	const components = new Set<WalkedAuthenticationCeremonyComponent>();
	const joinedPath = path.join("/");
	for (const [comp, parents] of walk(component)) {
		const currentPath = parents.map((c) => {
			if (c.kind === "prompt") {
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
		// deno-lint-ignore no-explicit-any
		return oneOf(...components) as any;
	}
}
