import { InvalidSendComponentPromptResponseError } from "./errors.ts";

export type SendComponentPromptResponse = {
	readonly sent: boolean;
};

export function isSendComponentPromptResponse(
	value: unknown,
): value is SendComponentPromptResponse {
	return !!value && typeof value === "object" &&
		"sent" in value && typeof value.sent === "boolean";
}

export function assertSendComponentPromptResponse(
	value: unknown,
): asserts value is SendComponentPromptResponse {
	if (!isSendComponentPromptResponse(value)) {
		throw new InvalidSendComponentPromptResponseError();
	}
}
