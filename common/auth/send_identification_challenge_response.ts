import { InvalidSendIdentificationChallengeResponseError } from "./errors.ts";

export type SendIdentificationChallengeResponse = {
	readonly sent: boolean;
};

export function isSendIdentificationChallengeResponse(
	value: unknown,
): value is SendIdentificationChallengeResponse {
	return !!value && typeof value === "object" &&
		"sent" in value && typeof value.sent === "boolean";
}

export function assertSendIdentificationChallengeResponse(
	value: unknown,
): asserts value is SendIdentificationChallengeResponse {
	if (!isSendIdentificationChallengeResponse(value)) {
		throw new InvalidSendIdentificationChallengeResponseError();
	}
}
