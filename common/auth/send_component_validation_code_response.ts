import { InvalidSendComponentValidationCodeResponseError } from "./errors.ts";

export type SendComponentValidationCodeResponse = {
	readonly sent: boolean;
};

export function isSendComponentValidationCodeResponse(
	value: unknown,
): value is SendComponentValidationCodeResponse {
	return !!value && typeof value === "object" &&
		"sent" in value && typeof value.sent === "boolean";
}

export function assertSendComponentValidationCodeResponse(
	value: unknown,
): asserts value is SendComponentValidationCodeResponse {
	if (!isSendComponentValidationCodeResponse(value)) {
		throw new InvalidSendComponentValidationCodeResponseError();
	}
}
