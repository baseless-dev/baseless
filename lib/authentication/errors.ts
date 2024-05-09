export class AuthenticationCeremonyDoneError extends Error {
	name = "AuthenticationCeremonyDoneError" as const;
}
export class AuthenticationInvalidStepError extends Error {
	name = "AuthenticationInvalidStepError" as const;
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
export class AuthenticationSubmitPromptError extends Error {
	name = "AuthenticationSubmitPromptError" as const;
}
export class AuthenticationSendPromptError extends Error {
	name = "AuthenticationSendPromptError" as const;
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
export class SendSignInPromptError extends Error {
	name = "SendSignInPromptError" as const;
}
