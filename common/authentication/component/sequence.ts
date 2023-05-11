import { InvalidAuthenticationCeremonyComponentSequenceError } from "../errors.ts";
import {
	AuthenticationCeremonyComponent,
	isAuthenticationCeremonyComponent,
} from "../ceremony.ts";

export type AuthenticationCeremonyComponentSequence = {
	readonly type: "sequence";
	readonly components: ReadonlyArray<AuthenticationCeremonyComponent>;
};

export function isAuthenticationCeremonyComponentSequence(
	value?: unknown,
): value is AuthenticationCeremonyComponentSequence {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && value.type === "sequence" &&
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
