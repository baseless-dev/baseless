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
	components: t.Record(t.String(), IdentityComponentSchema),
}, { $id: "AuthenticationSignInState" });

export type AuthenticationSignUpState = Static<
	typeof AuthenticationSignUpStateSchema
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

export const AuthenticationSignInResponseDoneSchema = t.Object({
	done: t.Literal(true),
	identityId: t.String(),
}, { $id: "AuthenticationSignInResponseDone" });

export type AuthenticationSignInResponseDone = Static<
	typeof AuthenticationSignInResponseDoneSchema
>;

export const AuthenticationSignInResponseErrorSchema = t.Object({
	done: t.Literal(false),
	error: t.Literal(true),
}, { $id: "AuthenticationSignInResponseError" });

export type AuthenticationSignInResponseError = Static<
	typeof AuthenticationSignInResponseErrorSchema
>;

export const AuthenticationSignInResponseStateSchema = t.Object({
	done: t.Literal(false),
	state: AuthenticationSignInStateSchema,
	component: AtPathAuthenticationCeremonyComponentSchema,
	first: t.Boolean(),
	last: t.Boolean(),
}, { $id: "AuthenticationSignInResponseState" });

export type AuthenticationSignInResponseState = Static<
	typeof AuthenticationSignInResponseSchema
>;

export const AuthenticationSignInResponseSchema = t.Union([
	AuthenticationSignInResponseDoneSchema,
	AuthenticationSignInResponseErrorSchema,
	AuthenticationSignInResponseStateSchema,
], { $id: "AuthenticationSignInResponse" });

export const AuthenticationSubmitSignInResponseDoneSchema = t.Object({
	done: t.Literal(true),
	access_token: t.String(),
	id_token: t.String(),
	refresh_token: t.Optional(t.String()),
}, { $id: "AuthenticationSubmitSignInResponseDone" });

export type AuthenticationSubmitSignInResponseDone = Static<
	typeof AuthenticationSubmitSignInResponseDoneSchema
>;

export const AuthenticationSubmitSignInResponseStateSchema = t.Object({
	done: t.Literal(false),
	state: t.String(),
	component: AtPathAuthenticationCeremonyComponentSchema,
	first: t.Boolean(),
	last: t.Boolean(),
}, { $id: "AuthenticationSubmitSignInResponseState" });

export type AuthenticationSubmitSignInResponseState = Static<
	typeof AuthenticationSubmitSignInResponseStateSchema
>;

export const AuthenticationSubmitSignInResponseSchema = t.Union([
	AuthenticationSubmitSignInResponseDoneSchema,
	AuthenticationSignInResponseErrorSchema,
	AuthenticationSubmitSignInResponseStateSchema,
], { $id: "AuthenticationSubmitSignInResponse" });

export type AuthenticationSubmitSignInResponse = Static<
	typeof AuthenticationSubmitSignInResponseSchema
>;

export type AuthenticationSignInResponse = Static<
	typeof AuthenticationSignInResponseSchema
>;

export const AuthenticationSignUpResponseSchema = t.Union([
	t.Object({
		done: t.Literal(true),
		tokens: AuthenticationTokensSchema,
	}, { $id: "AuthenticationSignUpResponseDone" }),
	t.Object({
		done: t.Literal(false),
		error: t.Literal(true),
	}, { $id: "AuthenticationSignUpResponseError" }),
	t.Object({
		done: t.Literal(false),
		state: AuthenticationSignUpStateSchema,
		components: t.Array(AuthenticationCeremonyComponentSchema),
		first: t.Boolean(),
		last: t.Boolean(),
	}, { $id: "AuthenticationSignUpResponseState" }),
], { $id: "AuthenticationSignUpResponse" });

export type AuthenticationSignUpResponse = Static<
	typeof AuthenticationSignUpResponseSchema
>;
