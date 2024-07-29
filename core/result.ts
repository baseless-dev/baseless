import {
	type TArray,
	type TLiteral,
	type TObject,
	type TRecursive,
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
	value: TUnknown;
}> = Type.Object({
	kind: Type.Literal("result"),
	value: Type.Unknown(),
}, { $id: "ResultSingle" });

export function isResultSingle(value: unknown): value is ResultSingle {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "result" &&
		"value" in value;
}

export interface ResultError {
	kind: "error";
	error: unknown;
}

export const ResultError: TObject<{
	kind: TLiteral<"error">;
	error: TUnknown;
}> = Type.Object({
	kind: Type.Literal("error"),
	error: Type.Unknown(),
}, { $id: "ResultError" });

export function isResultError(value: unknown): value is ResultError {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "error" &&
		"error" in value;
}

export interface Results {
	kind: "results";
	results: ResultSingle[];
}

export const Results: TObject<{
	kind: TLiteral<"results">;
	results: TArray<typeof ResultSingle>;
}> = Type.Object({
	kind: Type.Literal("results"),
	results: Type.Array(ResultSingle),
}, { $id: "Results" });

export function isResults(value: unknown): value is Results {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "results" &&
		"results" in value && Array.isArray(value.results) && value.results.every(isResultSingle);
}

export type Result = ResultSingle | ResultError | Results;

export const Result: TRecursive<
	TUnion<[
		typeof ResultSingle,
		typeof ResultError,
		TObject<{
			kind: TLiteral<"results">;
			results: TArray<TThis>;
		}>,
	]>
> = Type.Recursive((self) =>
	Type.Union([
		ResultSingle,
		ResultError,
		Type.Object({
			kind: Type.Literal("results"),
			results: Type.Array(self),
		}),
	])
);

export function isResult(value: unknown): value is Result {
	return isResultSingle(value) || isResults(value);
}
