import { isSchema } from "../../../schema/types.ts";
import {
	type AuthenticationCeremonyComponent,
	AuthenticationCeremonyComponentChoiceSchema,
	AuthenticationCeremonyComponentConditionalSchema,
	AuthenticationCeremonyComponentSequenceSchema,
} from "../ceremony.ts";
import { oneOf } from "./helpers.ts";
import { simplify } from "./simplify.ts";

export class AuthenticationCeremonyComponentAtPathError extends Error {}

export type GetComponentAtPathYieldResult = {
	done: false;
	component: AuthenticationCeremonyComponent;
};
export type GetComponentAtPathReturnResult = { done: true };
export type GetComponentAtPathResult =
	| GetComponentAtPathYieldResult
	| GetComponentAtPathReturnResult;

export function getComponentAtPath(
	component: AuthenticationCeremonyComponent,
	path: string[],
): GetComponentAtPathResult {
	if (isSchema(AuthenticationCeremonyComponentSequenceSchema, component)) {
		let i = 0;
		const componentLength = component.components.length;
		const pathLen = path.length;
		for (; i < pathLen; ++i) {
			if (component.components[i].kind !== path[i]) {
				break;
			}
		}
		if (i === componentLength) {
			return { done: true };
		}
		if (i !== pathLen) {
			throw new AuthenticationCeremonyComponentAtPathError();
		}
		return { done: false, component: component.components.at(i)! };
	} else if (isSchema(AuthenticationCeremonyComponentChoiceSchema, component)) {
		const nextComponents: GetComponentAtPathResult[] = [];
		for (const inner of component.components) {
			try {
				nextComponents.push(getComponentAtPath(inner, path));
			} catch (_err) {
				// skip
			}
		}
		if (nextComponents.some((ns) => ns.done)) {
			return { done: true };
		}
		if (nextComponents.length === 1) {
			return nextComponents.at(0)!;
		} else if (nextComponents.length) {
			const components = nextComponents.reduce((components, component) => {
				if (component.done === false) {
					components.push(component.component);
				}
				return components;
			}, [] as AuthenticationCeremonyComponent[]);
			return {
				done: false,
				component: simplify(oneOf(...new Set(components))),
			};
		}
	} else if (
		isSchema(AuthenticationCeremonyComponentConditionalSchema, component)
	) {
		throw new AuthenticationCeremonyComponentAtPathError();
	} else if (path.length === 0) {
		return { done: false, component };
	} else if (component.id === path.at(0)!) {
		return { done: true };
	}
	throw new AuthenticationCeremonyComponentAtPathError();
}
