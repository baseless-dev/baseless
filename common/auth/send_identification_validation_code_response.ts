import { InvalidSendIdentificationValidationCodeResponseError } from "./errors.ts";

export type SendIdentificationValidationCodeResponse = {
	readonly sent: boolean;
};

export function isSendIdentificationValidationCodeResponse(
	value: unknown,
): value is SendIdentificationValidationCodeResponse {
	return !!value && typeof value === "object" &&
		"sent" in value && typeof value.sent === "boolean";
}

export function assertSendIdentificationValidationCodeResponse(
	value: unknown,
): asserts value is SendIdentificationValidationCodeResponse {
	if (!isSendIdentificationValidationCodeResponse(value)) {
		throw new InvalidSendIdentificationValidationCodeResponseError();
	}
}
