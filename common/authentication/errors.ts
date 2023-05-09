export class InvalidAuthenticationStepError extends Error {
	name = "InvalidAuthenticationStepError" as const;
}
export class InvalidAuthenticationStateAnonymous extends Error {
	name = "InvalidAuthenticationStateAnonymous" as const;
}
export class InvalidAuthenticationStateIdentified extends Error {
	name = "InvalidAuthenticationStateIdentified" as const;
}
export class InvalidAuthenticationState extends Error {
	name = "InvalidAuthenticationState" as const;
}
export class InvalidAuthenticationChallengeError extends Error {
	name = "InvalidAuthenticationChallengeError" as const;
}
export class InvalidAuthenticationChoiceError extends Error {
	name = "InvalidAuthenticationChoiceError" as const;
}
export class InvalidAuthenticationConditionalError extends Error {
	name = "InvalidAuthenticationConditionalError" as const;
}
export class InvalidAuthenticationIdentificationError extends Error {
	name = "InvalidAuthenticationIdentificationError" as const;
}
export class InvalidAuthenticationSequenceError extends Error {
	name = "InvalidAuthenticationSequenceError" as const;
}
export class InvalidAuthenticationResultDoneError extends Error {
	name = "InvalidAuthenticationResultDoneError" as const;
}
export class InvalidAuthenticationResultErrorError extends Error {
	name = "InvalidAuthenticationResultErrorError" as const;
}
export class InvalidAuthenticationResultRedirectError extends Error {
	name = "InvalidAuthenticationResultRedirectError" as const;
}
export class InvalidAuthenticationResultStateError extends Error {
	name = "InvalidAuthenticationResultStateError" as const;
}
export class InvalidAuthenticationResultEncryptedStateError extends Error {
	name = "InvalidAuthenticationResultEncryptedStateError" as const;
}
export class InvalidAuthenticationResultError extends Error {
	name = "InvalidAuthenticationResultError" as const;
}
export class AuthenticationFlowDoneError extends Error {
	name = "AuthenticationFlowDoneError" as const;
}
export class AuthenticationInvalidStepError extends Error {
	name = "AuthenticationInvalidStepError" as const;
}
export class AuthenticationRateLimitedError extends Error {
	name = "AuthenticationRateLimitedError" as const;
}
export class AuthenticationMissingChallengeError extends Error {
	name = "AuthenticationMissingChallengeError" as const;
}
export class AuthenticationChallengeFailedError extends Error {
	name = "AuthenticationChallengeFailedError" as const;
}
export class AuthenticationMissingIdentificationError extends Error {
	name = "AuthenticationMissingIdentificationError" as const;
}
export class AuthenticationSendValidationCodeError extends Error {
	name = "AuthenticationSendValidationCodeError" as const;
}
export class AuthenticationConfirmValidationCodeError extends Error {
	name = "AuthenticationConfirmValidationCodeError" as const;
}