import { InvalidAuthenticationCeremonyComponentChallengeError } from "../../errors.ts";

export interface AuthenticationCeremonyComponentChallenge {
	readonly kind: string;
	readonly prompt: "password" | "otp";
}

export function isAuthenticationCeremonyComponentChallenge(
	value?: unknown,
): value is AuthenticationCeremonyComponentChallenge {
	return !!value && typeof value === "object" && "kind" in value &&
		typeof value.kind === "string" && "prompt" in value &&
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
