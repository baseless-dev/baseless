import { InvalidConfirmChallengeValidationCodeResponseError } from "./errors.ts";

export type ConfirmChallengeValidationCodeResponse = {
	readonly confirmed: boolean;
};

export function isConfirmChallengeValidationCodeResponse(
	value: unknown,
): value is ConfirmChallengeValidationCodeResponse {
	return !!value && typeof value === "object" &&
		"confirmed" in value && typeof value.confirmed === "boolean";
}

export function assertConfirmChallengeValidationCodeResponse(
	value: unknown,
): asserts value is ConfirmChallengeValidationCodeResponse {
	if (!isConfirmChallengeValidationCodeResponse(value)) {
		throw new InvalidConfirmChallengeValidationCodeResponseError();
	}
}
