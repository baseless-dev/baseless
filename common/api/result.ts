import {
	InvalidApiResultDataError,
	InvalidApiResultError,
	InvalidApiResultErrorError,
} from "./errors.ts";

export type ApiResultData = { data: Record<string, unknown> };
export type ApiResultError = { error: string };
export type ApiResult = ApiResultData | ApiResultError;

export function isApiResultData(value?: unknown): value is ApiResultData {
	return !!value && typeof value === "object" && "data" in value &&
		typeof value.data === "object";
}

export function assertApiResultData(
	value?: unknown,
): asserts value is ApiResultData {
	if (!isApiResultData(value)) {
		throw new InvalidApiResultDataError();
	}
}

export function isApiResultError(value?: unknown): value is ApiResultError {
	return !!value && typeof value === "object" && "error" in value &&
		typeof value.error === "string";
}

export function assertApiResultError(
	value?: unknown,
): asserts value is ApiResultError {
	if (!isApiResultError(value)) {
		throw new InvalidApiResultErrorError();
	}
}

export function isApiResult(value?: unknown): value is ApiResult {
	return isApiResultData(value) || isApiResultError(value);
}

export function assertApiResult(value?: unknown): asserts value is ApiResult {
	if (!isApiResult(value)) {
		throw new InvalidApiResultError();
	}
}
