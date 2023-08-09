import { isSchema } from "../../../schema/types.ts";
import {
	AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentSequenceSchema,
} from "../ceremony.ts";
import { flatten } from "./flatten.ts";
import { h } from "./helpers.ts";
import { isLeaf } from "./is_leaf.ts";
import { simplify } from "./simplify.ts";

export const EOS = Symbol("End of sequence");

export default function* walk(
	component: AuthenticationCeremonyComponent,
	parents: AuthenticationCeremonyComponent[] = [],
	isRoot: boolean = true,
): Generator<
	[
		component: AuthenticationCeremonyComponent | typeof EOS,
		parents: ReadonlyArray<AuthenticationCeremonyComponent>,
	]
> {
	if (isSchema(AuthenticationCeremonyComponentSequenceSchema, component)) {
		if (isLeaf(component)) {
			const newParents = [...parents];
			for (const inner of component.components) {
				yield* walk(inner, [...newParents], false);
				newParents.push(inner);
			}
			yield [EOS, newParents];
		} else {
			for (let i = 0, l = component.components.length; i < l; ++i) {
				const inner = component.components[i];
				if (isSchema(AuthenticationCeremonyComponentChoiceSchema, inner)) {
					for (const inner2 of inner.components) {
						yield* walk(
							simplify(h.sequence(
								...component.components.slice(0, i),
								inner2,
								...component.components.slice(i + 1),
							)),
							[...parents],
							false,
						);
					}
					break;
				}
			}
		}
	} else if (isSchema(AuthenticationCeremonyComponentChoiceSchema, component)) {
		for (const inner of component.components) {
			yield* walk(inner, [...parents], false);
			if (isLeaf(inner)) {
				yield [EOS, [...parents, inner]];
			}
		}
	} else {
		yield [component, parents];
		if (isRoot) {
			yield [EOS, [...parents, component]];
		}
	}
}
