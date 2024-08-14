import {
	type TArray,
	type TLiteral,
	type TObject,
	type TRecord,
	type TString,
	type TUnion,
	TUnknown,
	Type,
} from "@sinclair/typebox";

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

export const AuthenticationComponentPrompt: TObject<{
	kind: TLiteral<"component">;
	id: TString;
	prompt: TString;
	options: TRecord<TString, TUnknown>;
}> = Type.Object({
	kind: Type.Literal("component"),
	id: Type.String(),
	prompt: Type.String(),
	options: Type.Record(Type.String(), Type.Unknown()),
}, { $id: "AuthenticationComponentPrompt" });

export const AuthenticationComponentChoice: TObject<{
	kind: TLiteral<"choice">;
	prompts: TArray<typeof AuthenticationComponentPrompt>;
}> = Type.Object({
	kind: Type.Literal("choice"),
	prompts: Type.Array(AuthenticationComponentPrompt),
}, { $id: "AuthenticationComponentChoice" });

export const AuthenticationComponent: TUnion<[
	typeof AuthenticationComponentPrompt,
	TObject<{
		kind: TLiteral<"choice">;
		prompts: TArray<typeof AuthenticationComponentPrompt>;
	}>,
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
