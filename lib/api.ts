import { type Static, t } from "../deps.ts";

export const ApiResponseDataSchema = t.Object({
	data: t.Unknown(),
}, { $id: "ApiResponseData" });

export const ApiResponseErrorSchema = t.Object({
	error: t.String(),
}, { $id: "ApiResponseError" });

export const ApiResponseSchema = t.Union([
	ApiResponseDataSchema,
	ApiResponseErrorSchema,
], { $id: "ApiResponse" });

export type ApiResponseData = Static<typeof ApiResponseDataSchema>;
export type ApiResponseError = Static<typeof ApiResponseErrorSchema>;
export type ApiResponse = Static<typeof ApiResponseSchema>;
