import * as z from "./schema.ts";

/**
 * A single prompt component presented to the user during an authentication or
 * registration ceremony. Describes what input to collect (e.g. an email address
 * or a TOTP code) via its `prompt` discriminator and `options` metadata.
 */
export interface AuthenticationComponentPrompt {
	kind: "component";
	id: string;
	prompt: string;
	options: Record<string, unknown>;
	sendable: boolean;
}

/**
 * A choice component that presents the user with multiple
 * {@link AuthenticationComponentPrompt} alternatives to select from.
 */
export interface AuthenticationComponentChoice {
	kind: "choice";
	prompts: AuthenticationComponentPrompt[];
}

/**
 * An authentication component — either a {@link AuthenticationComponentPrompt}
 * or an {@link AuthenticationComponentChoice}.
 */
export type AuthenticationComponent =
	| AuthenticationComponentPrompt
	| AuthenticationComponentChoice;

/** Zod schema for {@link AuthenticationComponentPrompt}. */
export const AuthenticationComponentPrompt: z.ZodObject<{
	kind: z.ZodLiteral<"component">;
	id: z.ZodString;
	prompt: z.ZodString;
	options: z.ZodRecord<z.ZodString, z.ZodUnknown>;
	sendable: z.ZodBoolean;
}> = z.strictObject({
	kind: z.literal("component"),
	id: z.string(),
	prompt: z.string(),
	options: z.record(z.string(), z.unknown()),
	sendable: z.boolean(),
}).meta({ id: "AuthenticationComponentPrompt" });

/** Zod schema for {@link AuthenticationComponentChoice}. */
export const AuthenticationComponentChoice: z.ZodObject<{
	kind: z.ZodLiteral<"choice">;
	prompts: z.ZodArray<typeof AuthenticationComponentPrompt>;
}> = z.strictObject({
	kind: z.literal("choice"),
	prompts: z.array(AuthenticationComponentPrompt),
}).meta({ id: "AuthenticationComponentChoice" });

/** Zod schema for {@link AuthenticationComponent}. */
export const AuthenticationComponent: z.ZodUnion<
	readonly [
		typeof AuthenticationComponentPrompt,
		typeof AuthenticationComponentChoice,
	]
> = z.union([
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
