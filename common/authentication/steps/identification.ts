import { InvalidAuthenticationIdentificationError } from "../errors.ts";

export type AuthenticationIdentification = {
	readonly type: string;
	readonly icon: string;
	readonly label: Record<string, string>;
	readonly prompt: "email" | "action";
};

export function isAuthenticationIdentification(
	value?: unknown,
): value is AuthenticationIdentification {
	return !!value && typeof value === "object" && "type" in value &&
		typeof value.type === "string" && "icon" in value &&
		typeof value.icon === "string" && "label" in value &&
		typeof value.label === "object" && "prompt" in value &&
		typeof value.prompt === "string" &&
		["email", "action"].includes(value.prompt);
}

export function assertAuthenticationIdentification(
	value?: unknown,
): asserts value is AuthenticationIdentification {
	if (!isAuthenticationIdentification(value)) {
		throw new InvalidAuthenticationIdentificationError();
	}
}