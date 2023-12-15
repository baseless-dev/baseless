import { InvalidConfirmComponentValidationCodeResponseError } from "./errors.ts";

export type ConfirmComponentValidationCodeResponse = {
	readonly confirmed: boolean;
};

export function isConfirmComponentValidationCodeResponse(
	value: unknown,
): value is ConfirmComponentValidationCodeResponse {
	return !!value && typeof value === "object" &&
		"confirmed" in value && typeof value.confirmed === "boolean";
}

export function assertConfirmComponentValidationCodeResponse(
	value: unknown,
): asserts value is ConfirmComponentValidationCodeResponse {
	if (!isConfirmComponentValidationCodeResponse(value)) {
		throw new InvalidConfirmComponentValidationCodeResponseError();
	}
}
