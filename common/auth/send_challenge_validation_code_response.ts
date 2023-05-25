import { InvalidSendChallengeValidationCodeResponseError } from "./errors.ts";

export type SendChallengeValidationCodeResponse = {
	readonly sent: boolean;
};

export function isSendChallengeValidationCodeResponse(
	value: unknown,
): value is SendChallengeValidationCodeResponse {
	return !!value && typeof value === "object" &&
		"sent" in value && typeof value.sent === "boolean";
}

export function assertSendChallengeValidationCodeResponse(
	value: unknown,
): asserts value is SendChallengeValidationCodeResponse {
	if (!isSendChallengeValidationCodeResponse(value)) {
		throw new InvalidSendChallengeValidationCodeResponseError();
	}
}
