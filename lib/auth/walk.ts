import {
	type AuthenticationCeremonyComponent,
	sequence,
	type WalkedAuthenticationCeremonyComponent,
} from "./types.ts";
import { isLeaf } from "./is_leaf.ts";
import { simplify } from "./simplify.ts";

export default function* walk(
	component: AuthenticationCeremonyComponent,
): Generator<
	[
		component: WalkedAuthenticationCeremonyComponent,
		parents: ReadonlyArray<WalkedAuthenticationCeremonyComponent>,
	]
> {
	function* _walk(
		component: AuthenticationCeremonyComponent,
		parents: WalkedAuthenticationCeremonyComponent[] = [],
	): Generator<
		[
			component: WalkedAuthenticationCeremonyComponent,
			parents: ReadonlyArray<WalkedAuthenticationCeremonyComponent>,
		]
	> {
		if (component.kind === "sequence") {
			if (isLeaf(component)) {
				const newParents = [...parents];
				for (const inner of component.components) {
					yield* _walk(inner, [...newParents]);
					newParents.push(inner as WalkedAuthenticationCeremonyComponent);
				}
			} else {
				for (let i = 0, l = component.components.length; i < l; ++i) {
					const inner = component.components[i];
					if (inner.kind === "choice") {
						for (const inner2 of inner.components) {
							yield* _walk(
								simplify(sequence(
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
		} else if (component.kind === "choice") {
			for (const inner of component.components) {
				yield* _walk(inner, [...parents]);
			}
		} else {
			yield [component, parents];
		}
	}
	yield* _walk(component);
}
