import type { AuthenticationCeremonyComponent } from "../ceremony.ts";
import { isAuthenticationCeremonyComponentChoice } from "./choice.ts";
import { oneOf, sequence } from "./helpers.ts";
import { isLeaf } from "./is_leaf.ts";
import { replace } from "./replace.ts";
import { isAuthenticationCeremonyComponentSequence } from "./sequence.ts";

export function flatten(
	step: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	const decomposed: AuthenticationCeremonyComponent[] = [];
	const trees: AuthenticationCeremonyComponent[] = [step];

	while (trees.length) {
		const root = trees.shift()!;
		if (isLeaf(root)) {
			decomposed.push(root);
		} else {
			let forked = false;
			const steps: AuthenticationCeremonyComponent[] = [];
			const walk: AuthenticationCeremonyComponent[] = [root];
			while (walk.length) {
				const node = walk.shift()!;
				if (isAuthenticationCeremonyComponentChoice(node)) {
					trees.push(
						...node.components.map((step) => replace(root, node, step)),
					);
					forked = true;
				} else if (isAuthenticationCeremonyComponentSequence(node)) {
					walk.unshift(...node.components);
				} else {
					steps.push(node);
				}
			}
			if (!forked) {
				trees.push(
					isAuthenticationCeremonyComponentSequence(root)
						? sequence(...steps)
						: oneOf(...steps),
				);
			}
		}
	}

	if (decomposed.length > 1) {
		return oneOf(...decomposed);
	}
	return decomposed.at(0)!;
}
