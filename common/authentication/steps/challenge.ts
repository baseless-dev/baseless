import { InvalidAuthenticationChallengeError } from "../errors.ts";

export type AuthenticationChallenge = {
	readonly type: string;
	readonly icon: string;
	readonly label: Record<string, string>;
	readonly prompt: "password" | "otp";
};

export function isAuthenticationChallenge(
	value?: unknown,
): value is AuthenticationChallenge {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && "icon" in value &&
		typeof value.icon === "string" && "label" in value &&
		typeof value.label === "object" && "prompt" in value &&
		typeof value.prompt === "string" &&
		["password", "otp"].includes(value.prompt);
}

export function assertAuthenticationChallenge(
	value?: unknown,
): asserts value is AuthenticationChallenge {
	if (!isAuthenticationChallenge(value)) {
		throw new InvalidAuthenticationChallengeError();
	}
}
