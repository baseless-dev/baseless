import { t } from "../deps.ts";

export const ApiResponseData = t.Object({
	data: t.Record(t.String(), t.Unknown()),
}, { $id: "ApiResponseData" });

export const ApiResponseError = t.Object({
	error: t.String(),
}, { $id: "ApiResponseError" });

export const ApiResponse = t.Union([
	ApiResponseData,
	ApiResponseError,
], { $id: "ApiResponse" });
