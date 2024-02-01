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

export const AuthenticationCeremonyStateSignInSchema = t.Object({
	kind: t.Literal("signin"),
	identity: t.Optional(t.String()),
	choices: t.Array(t.String()),
}, { $id: "AuthenticationCeremonyStateSignIn" });

export type AuthenticationCeremonyStateSignIn = Static<
	typeof AuthenticationCeremonyStateSignInSchema
>;

export const AuthenticationCeremonyStateSignUpSchema = t.Object({
	kind: t.Literal("signup"),
	components: t.Array(IdentityComponentSchema),
}, { $id: "AuthenticationCeremonyStateSignUp" });

export type AuthenticationCeremonyStateSignUp = Static<
	typeof AuthenticationCeremonyStateSignUpSchema
>;

export const AuthenticationCeremonyStateSchema = t.Union([
	AuthenticationCeremonyStateSignInSchema,
	AuthenticationCeremonyStateSignUpSchema,
], { $id: "AuthenticationCeremonyState" });

export type AuthenticationCeremonyState = Static<
	typeof AuthenticationCeremonyStateSchema
>;

export const AuthenticationCeremonyResponseDoneSchema = t.Object({
	done: t.Literal(true),
	identityId: t.Optional(t.String()),
}, { $id: "AuthenticationCeremonyResponseDone" });

export type AuthenticationCeremonyResponseDone = Static<
	typeof AuthenticationCeremonyResponseDoneSchema
>;

export const AuthenticationCeremonyResponseErrorSchema = t.Object({
	done: t.Literal(false),
	error: t.Literal(true),
}, { $id: "AuthenticationCeremonyResponseError" });

export type AuthenticationCeremonyResponseError = Static<
	typeof AuthenticationCeremonyResponseErrorSchema
>;

export const AuthenticationCeremonyResponseStartSchema = t.Object({
	done: t.Literal(false),
	component: AtPathAuthenticationCeremonyComponentSchema,
	first: t.Literal(true),
	last: t.Boolean(),
}, { $id: "AuthenticationCeremonyResponseStart" });

export type AuthenticationCeremonyResponseStart = Static<
	typeof AuthenticationCeremonyResponseStartSchema
>;

export const AuthenticationCeremonyResponseNextSchema = t.Object({
	done: t.Literal(false),
	encryptedState: t.String(),
	component: AtPathAuthenticationCeremonyComponentSchema,
	first: t.Boolean(),
	last: t.Boolean(),
}, { $id: "AuthenticationCeremonyResponseNext" });

export type AuthenticationCeremonyResponseNext = Static<
	typeof AuthenticationCeremonyResponseNextSchema
>;

export const AuthenticationCeremonyResponseSchema = t.Union([
	AuthenticationCeremonyResponseDoneSchema,
	AuthenticationCeremonyResponseErrorSchema,
	AuthenticationCeremonyResponseStartSchema,
	AuthenticationCeremonyResponseNextSchema,
], { $id: "AuthenticationCeremonyResponse" });

export type AuthenticationCeremonyResponse = Static<
	typeof AuthenticationCeremonyResponseSchema
>;

export const AuthenticationSignInResponseDoneSchema = t.Object({
	done: t.Literal(true),
	access_token: t.String(),
	id_token: t.String(),
	refresh_token: t.Optional(t.String()),
}, { $id: "AuthenticationSignInResponseDone" });

export const AuthenticationSignInResponseSchema = t.Union([
	AuthenticationSignInResponseDoneSchema,
	AuthenticationCeremonyResponseErrorSchema,
	AuthenticationCeremonyResponseStartSchema,
	AuthenticationCeremonyResponseNextSchema,
], { $id: "AuthenticationSignInResponse" });

export type AuthenticationSignInResponse = Static<
	typeof AuthenticationSignInResponseSchema
>;

export const AuthenticationSignUpResponseDoneSchema = t.Object({
	done: t.Literal(true),
	components: t.Array(IdentityComponentSchema),
}, { $id: "AuthenticationSignUpResponseDone" });

export const AuthenticationSignUpResponseSchema = t.Union([
	AuthenticationSignUpResponseDoneSchema,
	AuthenticationCeremonyResponseErrorSchema,
	AuthenticationCeremonyResponseStartSchema,
	AuthenticationCeremonyResponseNextSchema,
], { $id: "AuthenticationSignInResponse" });

export type AuthenticationSignUpResponse = Static<
	typeof AuthenticationSignUpResponseSchema
>;
