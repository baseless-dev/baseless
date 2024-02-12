import { Assert } from "../../deps.ts";
import { type Static, t } from "../../deps.ts";

export const AuthenticationTokensSchema = t.Object({
	access_token: t.String(),
	id_token: t.String(),
	refresh_token: t.Optional(t.String()),
}, { $id: "AuthenticationTokens" });

export type AuthenticationTokens = Static<typeof AuthenticationTokensSchema>;

export const AuthenticationSendPromptResultSchema = t.Object({
	sent: t.Boolean(),
}, { $id: "AuthenticationSendPromptResult" });

export type AuthenticationSendPromptResult = Static<
	typeof AuthenticationSendPromptResultSchema
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
		components: t.Array(AuthenticationCeremonyComponentPromptSchema),
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

export const AuthenticationCeremonyStateNextSchema = t.Object({
	done: t.Literal(false),
	component: AtPathAuthenticationCeremonyComponentSchema,
	first: t.Boolean(),
	last: t.Boolean(),
	state: t.Optional(t.String()),
}, { $id: "AuthenticationCeremonyStateNext" });

export type AuthenticationCeremonyStateNext = Static<
	typeof AuthenticationCeremonyStateNextSchema
>;

export const AuthenticationCeremonyStateDoneSchema = t.Object({
	done: t.Literal(true),
}, { $id: "AuthenticationCeremonyStateDone" });

export type AuthenticationCeremonyStateDone = Static<
	typeof AuthenticationCeremonyStateDoneSchema
>;

export const AuthenticationCeremonyStateSchema = t.Union([
	AuthenticationCeremonyStateNextSchema,
	AuthenticationCeremonyStateDoneSchema,
], { $id: "AuthenticationCeremonyState" });

export type AuthenticationCeremonyState = Static<
	typeof AuthenticationCeremonyStateSchema
>;

export const AuthenticationStateSchema = t.Object({
	kind: t.Literal("authentication"),
	identity: t.Optional(t.String()),
	choices: t.Array(t.String()),
}, { $id: "AuthenticationState" });

export type AuthenticationState = Static<
	typeof AuthenticationStateSchema
>;

export const AuthenticationSubmitPromptStateDoneSchema = t.Object({
	done: t.Literal(true),
	access_token: t.String(),
	id_token: t.String(),
	refresh_token: t.Optional(t.String()),
}, { $id: "AuthenticationSubmitPromptStateDone" });

export type AuthenticationSubmitPromptStateDone = Static<
	typeof AuthenticationSubmitPromptStateDoneSchema
>;

export const AuthenticationSubmitPromptStateSchema = t.Union([
	AuthenticationCeremonyStateNextSchema,
	AuthenticationSubmitPromptStateDoneSchema,
], { $id: "AuthenticationSubmitPromptState" });

export type AuthenticationSubmitPromptState = Static<
	typeof AuthenticationSubmitPromptStateSchema
>;
