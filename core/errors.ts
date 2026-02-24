import * as z from "./schema.ts";

/**
 * Base class for errors that are safe to expose over the network.
 * Subclasses expose an HTTP `status`, `statusText`, and optional `details`
 * payload that the server serializes into the response body.
 */
export abstract class PublicError extends Error {
	abstract status: number;
	abstract statusText: string;
	abstract details: unknown;
}
/**
 * A generic server-reported error whose `error` string identifies the error
 * class and `details` carries extra context.
 * Used when the server returns an error discriminator not matched by any
 * known {@link PublicError} subclass.
 */
export class ServerError extends Error {
	error: string;
	details: unknown;
	constructor(error: string, details: unknown | undefined) {
		super("Unknown error");
		this.error = error;
		this.details = details;
	}
}
/** HTTP 400 Bad Request. Thrown for malformed or invalid requests. */
export class BadRequestError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
/** HTTP 500 Internal Server Error. Thrown for unexpected server failures. */
export class InternalServerError extends PublicError {
	status = 500;
	statusText = "Internal Server Error";
	details = null;
}
/** HTTP 502 Bad Gateway. Thrown when an upstream dependency fails. */
export class BadGatewayError extends PublicError {
	status = 502;
	statusText = "Bad Gateway";
	details = null;
}
/** HTTP 401 Unauthorized. Thrown when a refresh token is invalid or expired. */
export class AuthenticationRefreshTokenError extends PublicError {
	status = 401;
	statusText = "Unauthorized";
	details = null;
}
/** HTTP 400 Bad Request. Thrown when sending an authentication prompt fails. */
export class AuthenticationSendPromptError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
/** HTTP 400 Bad Request. Thrown when sending an authentication validation code fails. */
export class AuthenticationSendValidationCodeError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
/** HTTP 400 Bad Request. Thrown when submitting an authentication prompt value fails. */
export class AuthenticationSubmitPromptError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
/** HTTP 400 Bad Request. Thrown when submitting an authentication validation code fails. */
export class AuthenticationSubmitValidationCodeError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
/** HTTP 404 Not Found. Thrown when a requested collection does not exist. */
export class CollectionNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
/** HTTP 409 Conflict. Thrown when an atomic document commit fails because a version check did not match. */
export class DocumentAtomicCommitError extends PublicError {
	status = 409;
	statusText = "Conflict";
	details = null;
}
/** HTTP 404 Not Found. Thrown when a requested document does not exist. */
export class DocumentNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
/** HTTP 403 Forbidden. Thrown when the caller lacks permission for the requested operation. */
export class ForbiddenError extends PublicError {
	status = 403;
	statusText = "Forbidden";
	details = null;
}
/** HTTP 400 Bad Request. Thrown when the authentication ceremony state token is invalid or expired. */
export class InvalidAuthenticationStateError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
/** HTTP 400 Bad Request. Thrown when the supplied authentication tokens are invalid or malformed. */
export class InvalidAuthenticationTokens extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
/** Thrown internally when an identity ID is not found or is in an invalid state. */
export class InvalidIdentityError extends Error {}
/** Thrown internally when a KV key does not exist. */
export class KVKeyNotFoundError extends Error {}
/** Thrown internally when a KV write operation fails. */
export class KVPutError extends Error {}
/** Thrown internally when a notification channel is not registered. */
export class NotificationChannelNotFoundError extends Error {}
/** HTTP 429 Too Many Requests. Thrown when the caller has exceeded a rate limit. */
export class RateLimitedError extends PublicError {
	status = 429;
	statusText = "Too Many Requests";
	details = null;
}
/** HTTP 404 Not Found. Thrown when no handler is registered for the requested path. */
export class RequestNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
/** HTTP 404 Not Found. Thrown when a pub/sub topic is not registered. */
export class TopicNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
/** Thrown internally when an authentication component ID is not recognized. */
export class UnknownIdentityComponentError extends Error {}

/**
 * The wire-format shape of an error response body returned by the server.
 */
export interface ServerErrorData {
	error: string;
	details?: unknown;
}
/** Zod schema for {@link ServerErrorData}. */
export const ServerErrorData = z.strictObject({
	error: z.string(),
	details: z.optional(z.unknown()),
}).meta({ id: "ServerErrorData" });

/**
 * Deserializes a {@link ServerErrorData} payload into the appropriate
 * {@link PublicError} subclass, falling back to a generic {@link ServerError}
 * when the `error` string is unrecognized.
 *
 * @param data The error data object received from the server.
 * @returns The corresponding error instance.
 */
export function fromServerErrorData(data: ServerErrorData): PublicError | ServerError {
	switch (data.error) {
		case AuthenticationRefreshTokenError.name:
			return new AuthenticationRefreshTokenError();
		case AuthenticationSendPromptError.name:
			return new AuthenticationSendPromptError();
		case AuthenticationSubmitPromptError.name:
			return new AuthenticationSubmitPromptError();
		case AuthenticationSubmitValidationCodeError.name:
			return new AuthenticationSubmitValidationCodeError();
		case BadRequestError.name:
			return new BadRequestError();
		case InternalServerError.name:
			return new InternalServerError();
		case BadGatewayError.name:
			return new BadGatewayError();
		case CollectionNotFoundError.name:
			return new CollectionNotFoundError();
		case DocumentAtomicCommitError.name:
			return new DocumentAtomicCommitError();
		case DocumentNotFoundError.name:
			return new DocumentNotFoundError();
		case ForbiddenError.name:
			return new ForbiddenError();
		case InvalidAuthenticationStateError.name:
			return new InvalidAuthenticationStateError();
		case InvalidAuthenticationTokens.name:
			return new InvalidAuthenticationTokens();
		case RateLimitedError.name:
			return new RateLimitedError();
		case RequestNotFoundError.name:
			return new RequestNotFoundError();
		case TopicNotFoundError.name:
			return new TopicNotFoundError();
	}
	return new ServerError(data.error, data.details);
}
