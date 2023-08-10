import {
	type AuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponentChoice,
	type AuthenticationCeremonyComponentSequence,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentSequence,
} from "../ceremony.ts";
import { h } from "./helpers.ts";
import { isLeaf } from "./is_leaf.ts";
import { simplify } from "./simplify.ts";

export default function* walk(
	component: AuthenticationCeremonyComponent,
): Generator<
	[
		component: Exclude<
			AuthenticationCeremonyComponent,
			| AuthenticationCeremonyComponentSequence
			| AuthenticationCeremonyComponentChoice
		>,
		parents: ReadonlyArray<AuthenticationCeremonyComponent>,
	]
> {
	function* _walk(
		component: AuthenticationCeremonyComponent,
		parents: AuthenticationCeremonyComponent[] = [],
	): Generator<
		[
			component: Exclude<
				AuthenticationCeremonyComponent,
				| AuthenticationCeremonyComponentSequence
				| AuthenticationCeremonyComponentChoice
			>,
			parents: ReadonlyArray<AuthenticationCeremonyComponent>,
		]
	> {
		if (isAuthenticationCeremonyComponentSequence(component)) {
			if (isLeaf(component)) {
				const newParents = [...parents];
				for (const inner of component.components) {
					yield* _walk(inner, [...newParents]);
					newParents.push(inner);
				}
			} else {
				for (let i = 0, l = component.components.length; i < l; ++i) {
					const inner = component.components[i];
					if (isAuthenticationCeremonyComponentChoice(inner)) {
						for (const inner2 of inner.components) {
							yield* _walk(
								simplify(h.sequence(
									...component.components.slice(0, i),
									inner2,
									...component.components.slice(i + 1),
								)),
								[...parents],
							);
						}
						break;
					}
				}
			}
		} else if (isAuthenticationCeremonyComponentChoice(component)) {
			for (const inner of component.components) {
				yield* _walk(inner, [...parents]);
			}
		} else {
			yield [component, parents];
		}
	}
	yield* _walk(component);
}
