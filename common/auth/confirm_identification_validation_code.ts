import { InvalidConfirmIdentificationValidationCodeResponseError } from "./errors.ts";

export type ConfirmIdentificationValidationCodeResponse = {
	readonly confirmed: boolean;
}

export function isConfirmIdentificationValidationCodeResponse(
	value: unknown,
): value is ConfirmIdentificationValidationCodeResponse {
	return !!value && typeof value === "object" &&
		"confirmed" in value && typeof value.confirmed === "boolean";
}

export function assertConfirmIdentificationValidationCodeResponse(
	value: unknown,
): asserts value is ConfirmIdentificationValidationCodeResponse {
	if (!isConfirmIdentificationValidationCodeResponse(value)) {
		throw new InvalidConfirmIdentificationValidationCodeResponseError();
	}
}