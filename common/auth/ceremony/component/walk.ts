import { isSchema } from "../../../schema/types.ts";
import {
	AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentSequenceSchema,
} from "../ceremony.ts";
import { h } from "./helpers.ts";

export default function* walk(
	component: AuthenticationCeremonyComponent,
	parents: AuthenticationCeremonyComponent[] = [],
): Generator<
	[
		component: AuthenticationCeremonyComponent,
		parents: ReadonlyArray<AuthenticationCeremonyComponent>,
	]
> {
	if (isSchema(AuthenticationCeremonyComponentSequenceSchema, component)) {
		for (const [inner] of walk(component.components[0], [...parents])) {
			yield [inner, [...parents]];
			if (component.components.length > 1) {
				yield* walk(h.sequence(...component.components.slice(1)), [
					...parents,
					inner,
				]);
			}
		}
	} else if (isSchema(AuthenticationCeremonyComponentChoiceSchema, component)) {
		for (const inner of component.components) {
			yield* walk(inner, [...parents]);
		}
	} else {
		yield [component, parents];
	}
}
