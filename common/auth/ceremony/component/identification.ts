import { InvalidAuthenticationCeremonyComponentIdentificationError } from "../../errors.ts";

export interface AuthenticationCeremonyComponentIdentification {
	readonly kind: string;
	readonly prompt: "email" | "action";
};

export function isAuthenticationCeremonyComponentIdentification(
	value?: unknown,
): value is AuthenticationCeremonyComponentIdentification {
	return !!value && typeof value === "object" && "kind" in value &&
		typeof value.kind === "string" && "prompt" in value &&
		typeof value.prompt === "string" &&
		["email", "action"].includes(value.prompt);
}

export function assertAuthenticationCeremonyComponentIdentification(
	value?: unknown,
): asserts value is AuthenticationCeremonyComponentIdentification {
	if (!isAuthenticationCeremonyComponentIdentification(value)) {
		throw new InvalidAuthenticationCeremonyComponentIdentificationError();
	}
}
