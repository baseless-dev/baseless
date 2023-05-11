import {
	InvalidApiResponseDataError,
	InvalidApiResponseError,
	InvalidApiResponseErrorError,
} from "./errors.ts";

export type ApiResponseData = { data: Record<string, unknown> };
export type ApiResponseError = { error: string };
export type ApiResponse = ApiResponseData | ApiResponseError;

export function isApiResponseData(value?: unknown): value is ApiResponseData {
	return !!value && typeof value === "object" && "data" in value &&
		typeof value.data === "object";
}

export function assertApiResponseData(
	value?: unknown,
): asserts value is ApiResponseData {
	if (!isApiResponseData(value)) {
		throw new InvalidApiResponseDataError();
	}
}

export function isApiResponseError(value?: unknown): value is ApiResponseError {
	return !!value && typeof value === "object" && "error" in value &&
		typeof value.error === "string";
}

export function assertApiResponseError(
	value?: unknown,
): asserts value is ApiResponseError {
	if (!isApiResponseError(value)) {
		throw new InvalidApiResponseErrorError();
	}
}

export function isApiResponse(value?: unknown): value is ApiResponse {
	return isApiResponseData(value) || isApiResponseError(value);
}

export function assertApiResponse(value?: unknown): asserts value is ApiResponse {
	if (!isApiResponse(value)) {
		throw new InvalidApiResponseError();
	}
}
