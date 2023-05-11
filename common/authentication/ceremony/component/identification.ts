import { InvalidAuthenticationCeremonyComponentIdentificationError } from "../../errors.ts";

export type AuthenticationCeremonyComponentIdentification = {
	readonly type: string;
	readonly icon: string;
	readonly label: Record<string, string>;
	readonly prompt: "email" | "action";
};

export function isAuthenticationCeremonyComponentIdentification(
	value?: unknown,
): value is AuthenticationCeremonyComponentIdentification {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && "icon" in value &&
		typeof value.icon === "string" && "label" in value &&
		typeof value.label === "object" && "prompt" in value &&
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
