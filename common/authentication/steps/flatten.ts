import type { AuthenticationStep } from "../step.ts";
import { isAuthenticationChoice } from "./choice.ts";
import { oneOf, sequence } from "./helpers.ts";
import { isLeaf } from "./is_leaf.ts";
import { replace } from "./replace.ts";
import { isAuthenticationSequence } from "./sequence.ts";

export function flatten(step: AuthenticationStep): AuthenticationStep {
	const decomposed: AuthenticationStep[] = [];
	const trees: AuthenticationStep[] = [step];

	while (trees.length) {
		const root = trees.shift()!;
		if (isLeaf(root)) {
			decomposed.push(root);
		} else {
			let forked = false;
			const steps: AuthenticationStep[] = [];
			const walk: AuthenticationStep[] = [root];
			while (walk.length) {
				const node = walk.shift()!;
				if (isAuthenticationChoice(node)) {
					trees.push(...node.choices.map((step) => replace(root, node, step)));
					forked = true;
				} else if (isAuthenticationSequence(node)) {
					walk.unshift(...node.steps);
				} else {
					steps.push(node);
				}
			}
			if (!forked) {
				trees.push(
					isAuthenticationSequence(root) ? sequence(...steps) : oneOf(...steps),
				);
			}
		}
	}

	if (decomposed.length > 1) {
		return oneOf(...decomposed);
	}
	return decomposed.at(0)!;
}