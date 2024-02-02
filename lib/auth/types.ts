import { Assert } from "../../deps.ts";
import { type Static, t } from "../../deps.ts";
import { IdentityComponentSchema } from "../identity/types.ts";

export const AuthenticationTokensSchema = t.Object({
	access_token: t.String(),
	id_token: t.String(),
	refresh_token: t.Optional(t.String()),
}, { $id: "AuthenticationTokens" });

export type AuthenticationTokens = Static<typeof AuthenticationTokensSchema>;

export const AuthenticationSendResultSchema = t.Object({
	sent: t.Boolean(),
}, { $id: "AuthenticationSendResult" });

export type AuthenticationSendResult = Static<
	typeof AuthenticationSendResultSchema
>;

export const AuthenticationConfirmResultSchema = t.Object({
	confirmed: t.Boolean(),
}, { $id: "AuthenticationConfirmResult" });

export type AuthenticationConfirmResult = Static<
	typeof AuthenticationConfirmResultSchema
>;

export const AuthenticationCeremonyComponentPromptSchema = t.Object({
	kind: t.Literal("prompt"),
	id: t.String(),
	prompt: t.Union([
		t.Literal("email"),
		t.Literal("oauth2"),
		t.Literal("password"),
		t.Literal("otp"),
		t.Literal("totp"),
		t.Literal("agreement"),
	]),
	options: t.Record(t.String(), t.Unknown()),
}, { $id: "AuthenticationCeremonyComponentPrompt" });

export type AuthenticationCeremonyComponentPrompt = Static<
	typeof AuthenticationCeremonyComponentPromptSchema
>;

export const AuthenticationCeremonyComponentDoneSchema = t.Object({
	kind: t.Literal("done"),
}, { $id: "AuthenticationCeremonyComponentDone" });

export const AuthenticationCeremonyComponentSchema = t.Recursive(
	(self) =>
		t.Union([
			t.Object({
				kind: t.Literal("sequence"),
				components: t.Array(self),
			}, { $id: "AuthenticationCeremonyComponentSequence" }),
			t.Object({
				kind: t.Literal("choice"),
				components: t.Array(self),
			}, { $id: "AuthenticationCeremonyComponentChoice" }),
			AuthenticationCeremonyComponentPromptSchema,
			AuthenticationCeremonyComponentDoneSchema,
		]),
	{ $id: "AuthenticationCeremonyComponent" },
);

export type AuthenticationCeremonyComponent = Static<
	typeof AuthenticationCeremonyComponentSchema
>;

export const WalkedAuthenticationCeremonyComponentSchema = t.Union([
	AuthenticationCeremonyComponentPromptSchema,
	AuthenticationCeremonyComponentDoneSchema,
], { $id: "WalkedAuthenticationCeremonyComponent" });

export type WalkedAuthenticationCeremonyComponent = Static<
	typeof WalkedAuthenticationCeremonyComponentSchema
>;

export const AtPathAuthenticationCeremonyComponentSchema = t.Union([
	AuthenticationCeremonyComponentPromptSchema,
	AuthenticationCeremonyComponentDoneSchema,
	t.Object({
		kind: t.Literal("choice"),
		components: t.Array(t.Union([
			AuthenticationCeremonyComponentPromptSchema,
			AuthenticationCeremonyComponentDoneSchema,
		])),
	}, { $id: "AtPathAuthenticationCeremonyComponentChoice" }),
], { $id: "AtPathAuthenticationCeremonyComponent" });

export type AtPathAuthenticationCeremonyComponent = Static<
	typeof AtPathAuthenticationCeremonyComponentSchema
>;

export function sequence(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponent {
	for (const component of components) {
		Assert(AuthenticationCeremonyComponentSchema, component);
	}
	return { kind: "sequence", components };
}

export function oneOf(
	...components: AuthenticationCeremonyComponent[]
): AuthenticationCeremonyComponent {
	for (const component of components) {
		Assert(AuthenticationCeremonyComponentSchema, component);
	}
	return { kind: "choice", components };
}

export const AuthenticationCeremonyResponseNextSchema = t.Object({
	done: t.Literal(false),
	component: AtPathAuthenticationCeremonyComponentSchema,
	first: t.Boolean(),
	last: t.Boolean(),
}, { $id: "AuthenticationCeremonyResponseNext" });

export type AuthenticationCeremonyResponseNext = Static<
	typeof AuthenticationCeremonyResponseNextSchema
>;

export const AuthenticationCeremonyResponseDoneSchema = t.Object({
	done: t.Literal(true),
}, { $id: "AuthenticationCeremonyResponseDone" });

export type AuthenticationCeremonyResponseDone = Static<
	typeof AuthenticationCeremonyResponseDoneSchema
>;

export const AuthenticationCeremonyResponseSchema = t.Union([
	AuthenticationCeremonyResponseNextSchema,
	AuthenticationCeremonyResponseDoneSchema,
], { $id: "AuthenticationCeremonyResponse" });

export type AuthenticationCeremonyResponse = Static<
	typeof AuthenticationCeremonyResponseSchema
>;

export const AuthenticationSignInStateSchema = t.Object({
	kind: t.Literal("signin"),
	identity: t.Optional(t.String()),
	choices: t.Array(t.String()),
}, { $id: "AuthenticationSignInState" });

export type AuthenticationSignInState = Static<
	typeof AuthenticationSignInStateSchema
>;

export const AuthenticationSignUpStateSchema = t.Object({
	kind: t.Literal("signup"),
	identity: t.Optional(t.String()),
	components: t.Array(IdentityComponentSchema),
}, { $id: "AuthenticationSignUpState" });

export type AuthenticationSignUpState = Static<
	typeof AuthenticationSignUpStateSchema
>;

export const AuthenticationStateSchema = t.Union([
	AuthenticationSignInStateSchema,
	AuthenticationSignUpStateSchema,
], { $id: "AuthenticationState" });

export type AuthenticationState = Static<
	typeof AuthenticationStateSchema
>;

// export const AuthenticationSignInResponseSchema = t.Object({
// 	state: t.String(),
// 	response: AuthenticationCeremonyResponseSchema,
// }, { $id: "AuthenticationSignInResponse" });

// export type AuthenticationSignInResponse = Static<
// 	typeof AuthenticationSignInResponseSchema
// >;

export const AuthenticationSignUpResponseSchema = t.Object({
	state: t.String(),
	response: AuthenticationCeremonyResponseSchema,
}, { $id: "AuthenticationSignUpResponse" });

export type AuthenticationSignUpResponse = Static<
	typeof AuthenticationSignUpResponseSchema
>;
