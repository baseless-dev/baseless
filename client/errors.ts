/** Error thrown when the current authentication ceremony has expired before completion. */
export class AuthenticationCeremonyExpiredError extends Error {}

/** Error thrown when the authentication ceremony is in an unexpected or invalid state. */
export class AuthenticationCeremonyInvalidStateError extends Error {}

/** Error thrown when the user submits an invalid prompt during an authentication ceremony. */
export class AuthenticationCeremonyInvalidPromptError extends Error {}
