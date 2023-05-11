import { InvalidAuthenticationCeremonyComponentChoiceError } from "../errors.ts";
import {
	AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony.ts";

export type AuthenticationCeremonyComponentChoice = {
	readonly type: "choice";
	readonly components: ReadonlyArray<AuthenticationCeremonyComponent>;
};

export function isAuthenticationCeremonyComponentChoice(
	value?: unknown,
): value is AuthenticationCeremonyComponentChoice {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && value.type === "choice" &&
		"components" in value && Array.isArray(value.components) &&
		value.components.every((c) => isAuthenticationCeremonyComponent(c));
}

export function assertAuthenticationCeremonyComponentChoice(
	value?: unknown,
): asserts value is AuthenticationCeremonyComponentChoice {
	if (!isAuthenticationCeremonyComponentChoice(value)) {
		throw new InvalidAuthenticationCeremonyComponentChoiceError();
	}
}
