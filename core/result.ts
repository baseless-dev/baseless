import {
	type TArray,
	type TLiteral,
	type TObject,
	type TOptional,
	type TRecursive,
	type TString,
	type TThis,
	type TUnion,
	type TUnknown,
	Type,
} from "@sinclair/typebox";

export interface ResultSingle {
	kind: "result";
	value: unknown;
}

export const ResultSingle: TObject<{
	kind: TLiteral<"result">;
	value: TOptional<TUnknown>;
}> = Type.Object({
	kind: Type.Literal("result"),
	value: Type.Optional(Type.Unknown()),
}, { $id: "ResultSingle" });

export function isResultSingle(value: unknown): value is ResultSingle {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "result";
}

export interface ResultError {
	kind: "error";
	name: string;
	detail?: unknown;
}

export const ResultError: TObject<{
	kind: TLiteral<"error">;
	name: TString;
	detail: TOptional<TUnknown>;
}> = Type.Object({
	kind: Type.Literal("error"),
	name: Type.String(),
	detail: Type.Optional(Type.Unknown()),
}, { $id: "ResultError" });

export function isResultError(value: unknown): value is ResultError {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "error" && "name" in value &&
		typeof value.name === "string";
}

export interface ResultUnknownError {
	kind: "unknown-error";
	error: unknown;
}

export const ResultUnknownError: TObject<{
	kind: TLiteral<"unknown-error">;
	error: TUnknown;
}> = Type.Object({
	kind: Type.Literal("unknown-error"),
	error: Type.Unknown(),
}, { $id: "ResultUnknownError" });

export function isResultUnknownError(value: unknown): value is ResultUnknownError {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "unknown-error" &&
		"error" in value;
}

export interface Results {
	kind: "results";
	results: Array<ResultSingle | ResultError | ResultUnknownError>;
}

export const Results: TObject<{
	kind: TLiteral<"results">;
	results: TArray<TUnion<[typeof ResultSingle, typeof ResultError, typeof ResultUnknownError]>>;
}> = Type.Object({
	kind: Type.Literal("results"),
	results: Type.Array(Type.Union([ResultSingle, ResultError, ResultUnknownError])),
}, { $id: "Results" });

export function isResults(value: unknown): value is Results {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "results" &&
		"results" in value && Array.isArray(value.results) &&
		value.results.every((r) => isResultSingle(r) || isResultError(r) || isResultUnknownError(r));
}

export type Result = ResultSingle | ResultError | ResultUnknownError | Results;

export const Result: TRecursive<
	TUnion<[
		typeof ResultSingle,
		typeof ResultError,
		typeof ResultUnknownError,
		TObject<{
			kind: TLiteral<"results">;
			results: TArray<TThis>;
		}>,
	]>
> = Type.Recursive((self) =>
	Type.Union([
		ResultSingle,
		ResultError,
		ResultUnknownError,
		Type.Object({
			kind: Type.Literal("results"),
			results: Type.Array(self),
		}),
	])
);

export function isResult(value: unknown): value is Result {
	return isResultSingle(value) || isResultError(value) || isResultUnknownError(value) || isResults(value);
}
