import { InvalidAuthenticationCeremonyComponentChallengeError } from "../../errors.ts";

export type AuthenticationCeremonyComponentChallenge = {
	readonly type: string;
	readonly icon: string;
	readonly label: Record<string, string>;
	readonly prompt: "password" | "otp";
};

export function isAuthenticationCeremonyComponentChallenge(
	value?: unknown,
): value is AuthenticationCeremonyComponentChallenge {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && "icon" in value &&
		typeof value.icon === "string" && "label" in value &&
		typeof value.label === "object" && "prompt" in value &&
		typeof value.prompt === "string" &&
		["password", "otp"].includes(value.prompt);
}

export function assertAuthenticationCeremonyComponentChallenge(
	value?: unknown,
): asserts value is AuthenticationCeremonyComponentChallenge {
	if (!isAuthenticationCeremonyComponentChallenge(value)) {
		throw new InvalidAuthenticationCeremonyComponentChallengeError();
	}
}
