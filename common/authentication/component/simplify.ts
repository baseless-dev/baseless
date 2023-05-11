import type { Context } from "../../../server/context.ts";
import type { AuthenticationCeremonyState } from "../state.ts";
import type { AuthenticationCeremonyComponent } from "../ceremony.ts";
import { isAuthenticationCeremonyComponentChoice } from "./choice.ts";
import { isAuthenticationCeremonyComponentConditional } from "./conditional.ts";
import { oneOf, sequence } from "./helpers.ts";
import { isAuthenticationCeremonyComponentSequence } from "./sequence.ts";

export function simplify(
	component: AuthenticationCeremonyComponent,
): AuthenticationCeremonyComponent {
	if (isAuthenticationCeremonyComponentSequence(component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (isAuthenticationCeremonyComponentSequence(inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		return sequence(...components);
	} else if (isAuthenticationCeremonyComponentChoice(component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = simplify(inner);
			if (isAuthenticationCeremonyComponentChoice(inner)) {
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
	context: Context,
	state: AuthenticationCeremonyState,
): Promise<AuthenticationCeremonyComponent> {
	if (isAuthenticationCeremonyComponentSequence(component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = await simplifyWithContext(inner, context, state);
			if (isAuthenticationCeremonyComponentSequence(inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		return sequence(...components);
	} else if (isAuthenticationCeremonyComponentChoice(component)) {
		const components: AuthenticationCeremonyComponent[] = [];
		for (let inner of component.components) {
			inner = await simplifyWithContext(inner, context, state);
			if (isAuthenticationCeremonyComponentChoice(inner)) {
				components.push(...inner.components);
			} else {
				components.push(inner);
			}
		}
		if (components.length === 1) {
			return components.at(0)!;
		}
		return oneOf(...components);
	} else if (isAuthenticationCeremonyComponentConditional(component)) {
		if (context && state) {
			const result = await component.condition(context, state);
			return simplifyWithContext(result, context, state);
		}
	}
	return component;
}
