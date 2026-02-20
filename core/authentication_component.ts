import * as z from "./schema.ts";

export interface AuthenticationComponentPrompt {
	kind: "component";
	id: string;
	prompt: string;
	options: Record<string, unknown>;
	sendable: boolean;
}

export interface AuthenticationComponentChoice {
	kind: "choice";
	prompts: AuthenticationComponentPrompt[];
}

export type AuthenticationComponent =
	| AuthenticationComponentPrompt
	| AuthenticationComponentChoice;

export const AuthenticationComponentPrompt = z.strictObject({
	kind: z.literal("component"),
	id: z.string(),
	prompt: z.string(),
	options: z.record(z.string(), z.unknown()),
	sendable: z.boolean(),
}).meta({ id: "AuthenticationComponentPrompt" });

export const AuthenticationComponentChoice = z.strictObject({
	kind: z.literal("choice"),
	prompts: z.array(AuthenticationComponentPrompt),
}).meta({ id: "AuthenticationComponentChoice" });

export const AuthenticationComponent = z.union([
	AuthenticationComponentPrompt,
	AuthenticationComponentChoice,
]).meta({ id: "AuthenticationComponent" });

/**
 * Check if the value is an {@link AuthenticationComponentPrompt}
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationComponentPrompt}
 */
export function isAuthenticationComponentPrompt(
	value: unknown,
): value is AuthenticationComponentPrompt {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "component" && "id" in value && typeof value.id === "string" &&
		"prompt" in value && typeof value.prompt === "string" && "options" in value &&
		typeof value.options === "object";
}

/**
 * Check if the value is an {@link AuthenticationComponentChoice}
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationComponentChoice}
 */
export function isAuthenticationComponentChoice(
	value: unknown,
): value is AuthenticationComponentChoice {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "choice" && "prompts" in value && Array.isArray(value.prompts) &&
		value.prompts.every(isAuthenticationComponentPrompt);
}

/**
 * Check if the value is an {@link AuthenticationComponent}.
 * @param value The value to test
 * @returns Whether the value is an {@link AuthenticationComponent}
 */
export function isAuthenticationComponent(value: unknown): value is AuthenticationComponent {
	return isAuthenticationComponentPrompt(value) || isAuthenticationComponentChoice(value);
}
