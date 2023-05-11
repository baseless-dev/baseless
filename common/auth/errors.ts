export class InvalidAuthenticationCeremonyComponentError extends Error {
	name = "InvalidAuthenticationCeremonyComponentError" as const;
}
export class InvalidAuthenticationCeremonyStateAnonymous extends Error {
	name = "InvalidAuthenticationCeremonyStateAnonymous" as const;
}
export class InvalidAuthenticationCeremonyStateIdentified extends Error {
	name = "InvalidAuthenticationCeremonyStateIdentified" as const;
}
export class InvalidAuthenticationCeremonyState extends Error {
	name = "InvalidAuthenticationCeremonyState" as const;
}
export class InvalidAuthenticationCeremonyComponentChallengeError
	extends Error {
	name = "InvalidAuthenticationCeremonyComponentChallengeError" as const;
}
export class InvalidAuthenticationCeremonyComponentChoiceError extends Error {
	name = "InvalidAuthenticationCeremonyComponentChoiceError" as const;
}
export class InvalidAuthenticationCeremonyComponentConditionalError
	extends Error {
	name = "InvalidAuthenticationCeremonyComponentConditionalError" as const;
}
export class InvalidAuthenticationCeremonyComponentIdentificationError
	extends Error {
	name = "InvalidAuthenticationCeremonyComponentIdentificationError" as const;
}
export class InvalidAuthenticationCeremonyComponentSequenceError extends Error {
	name = "InvalidAuthenticationCeremonyComponentSequenceError" as const;
}
export class InvalidAuthenticationCeremonyResponseDoneError extends Error {
	name = "InvalidAuthenticationCeremonyResponseDoneError" as const;
}
export class InvalidAuthenticationCeremonyResponseErrorError extends Error {
	name = "InvalidAuthenticationCeremonyResponseErrorError" as const;
}
export class InvalidAuthenticationCeremonyResponseRedirectError extends Error {
	name = "InvalidAuthenticationCeremonyResponseRedirectError" as const;
}
export class InvalidAuthenticationCeremonyResponseStateError extends Error {
	name = "InvalidAuthenticationCeremonyResponseStateError" as const;
}
export class InvalidAuthenticationCeremonyResponseEncryptedStateError
	extends Error {
	name = "InvalidAuthenticationCeremonyResponseEncryptedStateError" as const;
}
export class InvalidAuthenticationCeremonyResponseError extends Error {
	name = "InvalidAuthenticationCeremonyResponseError" as const;
}
export class AuthenticationCeremonyDoneError extends Error {
	name = "AuthenticationCeremonyDoneError" as const;
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
export class AuthenticationCeremonyComponentChallengeFailedError extends Error {
	name = "AuthenticationCeremonyComponentChallengeFailedError" as const;
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

export class InvalidSendIdentificationValidationCodeResponseError
	extends Error {
	name = "InvalidSendIdentificationValidationCodeResponseError" as const;
}

export class InvalidConfirmIdentificationValidationCodeResponseError
	extends Error {
	name = "InvalidConfirmIdentificationValidationCodeResponseError" as const;
}