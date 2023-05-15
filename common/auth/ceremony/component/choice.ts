import { InvalidAuthenticationCeremonyComponentChoiceError } from "../../errors.ts";
import {
	AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony.ts";

export type AuthenticationCeremonyComponentChoice = {
	readonly kind: "choice";
	readonly components: ReadonlyArray<AuthenticationCeremonyComponent>;
};

export function isAuthenticationCeremonyComponentChoice(
	value?: unknown,
): value is AuthenticationCeremonyComponentChoice {
	return !!value && typeof value === "object" && "kind" in value &&
		typeof value.kind === "string" && value.kind === "choice" &&
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
