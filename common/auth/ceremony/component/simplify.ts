import {
	type AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentConditionalSchema,
	AuthenticationCeremonyComponentSequenceSchema,
} from "../ceremony.ts";
import { oneOf, sequence } from "./helpers.ts";
import type { IContext } from "../../../server/context.ts";
import { Infer, isSchema } from "../../../schema/types.ts";
import { type AuthenticationCeremonyStateSchema } from "../state.ts";

export function simplify(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	if (isSchema(AuthenticationCeremonyComponentSequenceSchema, component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (isSchema(AuthenticationCeremonyComponentSequenceSchema, inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		return sequence(...components);
	} else if (isSchema(AuthenticationCeremonyComponentChoiceSchema, component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (isSchema(AuthenticationCeremonyComponentChoiceSchema, inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		if (components.length === 1) {
			return components.at(0)!;
		}
		return oneOf(...components);
	}
	return component;
}

export async function simplifyWithContext(
	component: AuthenticationCeremonyComponent,
	context: IContext,
	state: Infer<typeof AuthenticationCeremonyStateSchema>,
): Promise<AuthenticationCeremonyComponent> {
	if (isSchema(AuthenticationCeremonyComponentSequenceSchema, component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = await simplifyWithContext(inner, context, state);
			if (isSchema(AuthenticationCeremonyComponentSequenceSchema, inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		return sequence(...components);
	} else if (isSchema(AuthenticationCeremonyComponentChoiceSchema, component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = await simplifyWithContext(inner, context, state);
			if (isSchema(AuthenticationCeremonyComponentChoiceSchema, inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		if (components.length === 1) {
			return components.at(0)!;
		}
		return oneOf(...components);
	} else if (
		isSchema(AuthenticationCeremonyComponentConditionalSchema, component)
	) {
		if (context && state) {
			const result = await component.condition(context, state);
			return simplifyWithContext(result, context, state);
		}
	}
	return component;
}
