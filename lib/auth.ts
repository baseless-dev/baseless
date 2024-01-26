import { t } from "../deps.ts";
import { IdentityComponent } from "./identity.ts";

export const AuthenticationTokens = t.Object({
	access_token: t.String(),
	id_token: t.String(),
	refresh_token: t.Optional(t.String()),
}, { $id: "AuthenticationTokens" });

export const AuthenticationSendResult = t.Object({
	sent: t.Boolean(),
}, { $id: "AuthenticationSendResult" });

export const AuthenticationConfirmResult = t.Object({
	confirmed: t.Boolean(),
}, { $id: "AuthenticationConfirmResult" });

export const AuthenticationSignInState = t.Object({
	kind: t.Literal("signin"),
	identity: t.Optional(t.String()),
	choices: t.Array(t.String()),
}, { $id: "AuthenticationSignInState" });

export const AuthenticationSignUpState = t.Object({
	kind: t.Literal("signup"),
	components: t.Record(t.String(), IdentityComponent),
}, { $id: "AuthenticationSignInState" });

export const AuthenticationCeremonyComponent = t.Recursive((self) =>
	t.Union([
		t.Object({
			kind: t.Literal("prompt"),
			id: t.String(),
			prompt: t.Union([
				t.Literal("email"),
				t.Literal("oauth2"),
				t.Literal("password"),
				t.Literal("otp"),
				t.Literal("totp"),
			]),
			options: t.Record(t.String(), t.Unknown()),
		}, { $id: "AuthenticationCeremonyComponentPrompt" }),
		t.Object({
			kind: t.Literal("sequence"),
			components: t.Array(self),
		}, { $id: "AuthenticationCeremonyComponentSequence" }),
		t.Object({
			kind: t.Literal("choice"),
			components: t.Array(self),
		}, { $id: "AuthenticationCeremonyComponentChoice" }),
		t.Object({
			kind: t.Literal("agreements"),
		}, { $id: "AuthenticationCeremonyComponentAgreement" }),
		t.Object({
			kind: t.Literal("done"),
		}, { $id: "AuthenticationCeremonyComponentDone" }),
	]), { $id: "AuthenticationCeremonyComponent" });

export const AuthenticationSignInResponse = t.Union([
	t.Object({
		done: t.Literal(true),
		tokens: AuthenticationTokens,
	}, { $id: "AuthenticationSignInResponseDone" }),
	t.Object({
		done: t.Literal(false),
		error: t.Literal(true),
	}, { $id: "AuthenticationSignInResponseError" }),
	t.Object({
		done: t.Literal(false),
		state: AuthenticationSignInState,
		components: t.Array(AuthenticationCeremonyComponent),
		first: t.Boolean(),
		last: t.Boolean(),
	}, { $id: "AuthenticationSignInResponseState" }),
], { $id: "AuthenticationSignInResponse" });

export const AuthenticationSignUpResponse = t.Union([
	t.Object({
		done: t.Literal(true),
		tokens: AuthenticationTokens,
	}, { $id: "AuthenticationSignUpResponseDone" }),
	t.Object({
		done: t.Literal(false),
		error: t.Literal(true),
	}, { $id: "AuthenticationSignUpResponseError" }),
	t.Object({
		done: t.Literal(false),
		state: AuthenticationSignUpState,
		components: t.Array(AuthenticationCeremonyComponent),
		first: t.Boolean(),
		last: t.Boolean(),
	}, { $id: "AuthenticationSignUpResponseState" }),
], { $id: "AuthenticationSignUpResponse" });

export class AuthenticationCeremonyDoneError extends Error {
	name = "AuthenticationCeremonyDoneError" as const;
}
export class AuthenticationInvalidStepError extends Error {
	name = "AuthenticationInvalidStepError" as const;
}
export class AuthenticationRateLimitedError extends Error {
	name = "AuthenticationRateLimitedError" as const;
}
export class AuthenticationSendValidationPromptError extends Error {
	name = "AuthenticationSendValidationPromptError" as const;
}
export class AuthenticationSendValidationCodeError extends Error {
	name = "AuthenticationSendValidationCodeError" as const;
}
export class AuthenticationConfirmValidationCodeError extends Error {
	name = "AuthenticationConfirmValidationCodeError" as const;
}
export class AuthenticationMissingIdentificatorError extends Error {
	name = "AuthenticationMissingIdentificatorError" as const;
}
export class UnauthorizedError extends Error {
	name = "UnauthorizedError" as const;
}
export class AnonymousIdentityNotAllowedError extends Error {
	name = "AnonymousIdentityNotAllowedError" as const;
}
export class HighRiskActionTimeWindowExpiredError extends Error {
	name = "HighRiskActionTimeWindowExpiredError" as const;
}
export class AuthenticationCeremonyComponentPromptError extends Error {
	name = "AuthenticationCeremonyComponentPromptError" as const;
}
export class MissingRefreshTokenError extends Error {
	name = "MissingRefreshTokenError" as const;
}
