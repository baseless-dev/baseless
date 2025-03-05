import * as Type from "./schema.ts";

export interface AuthenticationComponentPrompt {
	kind: "component";
	id: string;
	prompt: string;
	options: Record<string, unknown>;
}

export interface AuthenticationComponentChoice {
	kind: "choice";
	prompts: AuthenticationComponentPrompt[];
}

export type AuthenticationComponent =
	| AuthenticationComponentPrompt
	| AuthenticationComponentChoice;

export const AuthenticationComponentPrompt: Type.TObject<{
	kind: Type.TLiteral<"component">;
	id: Type.TString;
	prompt: Type.TString;
	options: Type.TRecord<Type.TUnknown>;
}, ["kind", "id", "prompt", "options"]> = Type.Object(
	{
		kind: Type.Literal("component"),
		id: Type.String(),
		prompt: Type.String(),
		options: Type.Record(Type.Unknown()),
	},
	["kind", "id", "prompt", "options"],
	{ $id: "AuthenticationComponentPrompt" },
);

export const AuthenticationComponentChoice: Type.TObject<{
	kind: Type.TLiteral<"choice">;
	prompts: Type.TArray<typeof AuthenticationComponentPrompt>;
}, ["kind", "prompts"]> = Type.Object(
	{
		kind: Type.Literal("choice"),
		prompts: Type.Array(AuthenticationComponentPrompt),
	},
	["kind", "prompts"],
	{ $id: "AuthenticationComponentChoice" },
);

export const AuthenticationComponent: Type.TUnion<[
	typeof AuthenticationComponentPrompt,
	Type.TObject<{
		kind: Type.TLiteral<"choice">;
		prompts: Type.TArray<typeof AuthenticationComponentPrompt>;
	}, ["kind", "prompts"]>,
]> = Type.Union([
	AuthenticationComponentPrompt,
	AuthenticationComponentChoice,
], { $id: "AuthenticationComponent" });

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
