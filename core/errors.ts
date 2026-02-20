import * as z from "./schema.ts";

export abstract class PublicError extends Error {
	abstract status: number;
	abstract statusText: string;
	abstract details: unknown;
}
export class ServerError extends Error {
	error: string;
	details: unknown;
	constructor(error: string, details: unknown | undefined) {
		super("Unknown error");
		this.error = error;
		this.details = details;
	}
}
export class BadRequestError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
export class InternalServerError extends PublicError {
	status = 500;
	statusText = "Internal Server Error";
	details = null;
}
export class BadGatewayError extends PublicError {
	status = 502;
	statusText = "Bad Gateway";
	details = null;
}
export class AuthenticationRefreshTokenError extends PublicError {
	status = 401;
	statusText = "Unauthorized";
	details = null;
}
export class AuthenticationSendPromptError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
export class AuthenticationSendValidationCodeError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
export class AuthenticationSubmitPromptError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
export class AuthenticationSubmitValidationCodeError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
export class CollectionNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
export class DocumentAtomicCommitError extends PublicError {
	status = 409;
	statusText = "Conflict";
	details = null;
}
export class DocumentNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
export class ForbiddenError extends PublicError {
	status = 403;
	statusText = "Forbidden";
	details = null;
}
export class InvalidAuthenticationStateError extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
export class InvalidAuthenticationTokens extends PublicError {
	status = 400;
	statusText = "Bad Request";
	details = null;
}
export class InvalidIdentityError extends Error {}
export class KVKeyNotFoundError extends Error {}
export class KVPutError extends Error {}
export class NotificationChannelNotFoundError extends Error {}
export class RateLimitedError extends PublicError {
	status = 429;
	statusText = "Too Many Requests";
	details = null;
}
export class RequestNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
export class TopicNotFoundError extends PublicError {
	status = 404;
	statusText = "Not Found";
	details = null;
}
export class UnknownIdentityComponentError extends Error {}

export interface ServerErrorData {
	error: string;
	details?: unknown;
}
export const ServerErrorData = z.strictObject({
	error: z.string(),
	details: z.optional(z.unknown()),
}).meta({ id: "ServerErrorData" });

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
