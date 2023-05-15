import { InvalidAuthenticationCeremonyComponentSequenceError } from "../../errors.ts";
import {
	AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony.ts";

export type AuthenticationCeremonyComponentSequence = {
	readonly kind: "sequence";
	readonly components: ReadonlyArray<AuthenticationCeremonyComponent>;
};

export function isAuthenticationCeremonyComponentSequence(
	value?: unknown,
): value is AuthenticationCeremonyComponentSequence {
	return !!value && typeof value === "object" && "kind" in value &&
		typeof value.kind === "string" && value.kind === "sequence" &&
		"components" in value && Array.isArray(value.components) &&
		value.components.every((c) => isAuthenticationCeremonyComponent(c));
}

export function assertAuthenticationCeremonyComponentSequence(
	value?: unknown,
): asserts value is AuthenticationCeremonyComponentSequence {
	if (!isAuthenticationCeremonyComponentSequence(value)) {
		throw new InvalidAuthenticationCeremonyComponentSequenceError();
	}
}
