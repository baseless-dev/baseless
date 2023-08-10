import { type IContext } from "../../../server/context.ts";
import {
	type AuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponentChoice,
	type AuthenticationCeremonyComponentConditional,
	type AuthenticationCeremonyComponentSequence,
	isAuthenticationCeremonyComponentChoice,
	isAuthenticationCeremonyComponentConditional,
	isAuthenticationCeremonyComponentSequence,
} from "../ceremony.ts";
import { type AuthenticationCeremonyState } from "../state.ts";
import { oneOf, sequence } from "./helpers.ts";

export type NonConditionalAuthenticationCeremonyComponent =
	| Exclude<
		AuthenticationCeremonyComponent,
		| AuthenticationCeremonyComponentSequence
		| AuthenticationCeremonyComponentChoice
		| AuthenticationCeremonyComponentConditional
	>
	| AuthenticationCeremonyComponentSequence<
		NonConditionalAuthenticationCeremonyComponent
	>
	| AuthenticationCeremonyComponentChoice<
		NonConditionalAuthenticationCeremonyComponent
	>;

export async function resolveConditional(
	component: AuthenticationCeremonyComponent,
	context?: IContext,
	state?: AuthenticationCeremonyState,
): Promise<NonConditionalAuthenticationCeremonyComponent> {
	if (isAuthenticationCeremonyComponentSequence(component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = await resolveConditional(inner, context, state);
			if (isAuthenticationCeremonyComponentSequence(inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		return sequence(
			...components,
		) as NonConditionalAuthenticationCeremonyComponent;
	} else if (isAuthenticationCeremonyComponentChoice(component)) {
		const components: NonConditionalAuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = await resolveConditional(inner, context, state);
			if (isAuthenticationCeremonyComponentChoice(inner)) {
				components.push(
					...inner
						.components as NonConditionalAuthenticationCeremonyComponent[],
				);
			} else {
				components.push(inner as NonConditionalAuthenticationCeremonyComponent);
			}
		}
		if (components.length === 1) {
			return components.at(0)!;
		}
		return oneOf(
			...components,
		) as NonConditionalAuthenticationCeremonyComponent;
	} else if (
		isAuthenticationCeremonyComponentConditional(component)
	) {
		const result = await component.condition(context, state);
		return resolveConditional(result, context, state);
	}
	return component;
}
