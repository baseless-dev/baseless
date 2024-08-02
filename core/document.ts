import { TArray, TObject, TSchema, TString, TUnknown, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export interface Document<TData = unknown> {
	key: string[];
	data: TData;
	versionstamp: string;
}

export function Document<TData extends TSchema = TUnknown>(data?: TData): TObject<{
	key: TArray<TString>;
	data: TData;
	versionstamp: TString;
}> {
	return Type.Object({
		key: Type.Array(Type.String()),
		data: data ?? Type.Unknown(),
		versionstamp: Type.String(),
	}, { $id: "Document" }) as never;
}

export function isDocument<TData extends TSchema>(
	data: TData,
	value: unknown,
): value is Document<TData> {
	return !!value && typeof value === "object" && "key" in value && Array.isArray(value.key) &&
		value.key.every((s) => typeof s === "string") && "data" in value &&
		"versionstamp" in value && typeof value.versionstamp === "string" &&
		Value.Check(data, value.data);
}
