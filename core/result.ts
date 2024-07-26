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

export interface ResultValue {
	kind: "result:value";
	value: unknown;
}

export const ResultValue: TObject<{
	kind: TLiteral<"result:value">;
	value: TUnknown;
}> = Type.Object({
	kind: Type.Literal("result:value"),
	value: Type.Unknown(),
}, { $id: "ResultValue" });

export function isResultValue(value: unknown): value is ResultValue {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "result:value" &&
		"value" in value;
}

export interface ResultBatched {
	kind: "result:batched";
	results: ResultValue[];
}

export const ResultBatched: TObject<{
	kind: TLiteral<"result:batched">;
	results: TArray<typeof ResultValue>;
}> = Type.Object({
	kind: Type.Literal("result:batched"),
	results: Type.Array(ResultValue),
}, { $id: "ResultBatched" });

export function isResultBatched(value: unknown): value is ResultBatched {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "result:batched" &&
		"results" in value && Array.isArray(value.results) && value.results.every(isResultValue);
}

export type Result = ResultValue | ResultBatched;

export const Result: TRecursive<
	TUnion<[
		typeof ResultValue,
		TObject<{
			kind: TLiteral<"result:batched">;
			results: TArray<TThis>;
		}>,
	]>
> = Type.Recursive((self) =>
	Type.Union([
		ResultValue,
		Type.Object({
			kind: Type.Literal("result:batched"),
			results: Type.Array(self),
		}),
	])
);

export function isResult(value: unknown): value is Result {
	return isResultValue(value) || isResultBatched(value);
}
