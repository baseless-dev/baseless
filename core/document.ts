import { TArray, TLiteral, TObject, TSchema, TString, TUnion, TUnknown, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export interface Document<TData = unknown> {
	key: string[];
	data: TData;
	versionstamp: string;
}

export type TDocument<TData extends TSchema = TUnknown> = TObject<{
	key: TArray<TString>;
	data: TData;
	versionstamp: TString;
}>;

export function Document<TData extends TSchema = TUnknown>(data?: TData): TDocument<TData> {
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

export interface DocumentChangeSet<TData = unknown> {
	type: "set";
	key: string[];
	data: TData;
}

export type TDocumentChangeSet<TData extends TSchema = TUnknown> = TObject<{
	type: TLiteral<"set">;
	key: TArray<TString>;
	data: TData;
}>;

export function DocumentChangeSet<TData extends TSchema = TUnknown>(data?: TData): TDocumentChangeSet<TData> {
	return Type.Object({
		type: Type.Literal("set"),
		key: Type.Array(Type.String()),
		data: data ?? Type.Unknown(),
	}, { $id: "DocumentChangeSet" }) as never;
}

export function isDocumentChangeSet<TData extends TSchema>(
	data: TData,
	value: unknown,
): value is Document<TData> {
	return !!value && typeof value === "object" && "type" in value && value.type === "set" &&
		"key" in value && Array.isArray(value.key) && value.key.every((s) => typeof s === "string") && "data" in value &&
		Value.Check(data, value.data);
}

export interface DocumentChangeDelete {
	type: "delete";
	key: string[];
}

export type TDocumentChangeDelete = TObject<{
	type: TLiteral<"delete">;
	key: TArray<TString>;
}>;

export const DocumentChangeDelete: TDocumentChangeDelete = Type.Object({
	type: Type.Literal("delete"),
	key: Type.Array(Type.String()),
}, { $id: "DocumentChangeDelete" });

export function isDocumentChangeDelete(
	value: unknown,
): value is DocumentChangeDelete {
	return !!value && typeof value === "object" && "type" in value && value.type === "delete" &&
		"key" in value && Array.isArray(value.key) && value.key.every((s) => typeof s === "string");
}

export type DocumentChange<TData = unknown> = DocumentChangeSet<TData> | DocumentChangeDelete;

export type TDocumentChange<TData extends TSchema = TUnknown> = TUnion<[TDocumentChangeSet<TData>, TDocumentChangeDelete]>;

export function DocumentChange<TData extends TSchema = TUnknown>(data?: TData): TDocumentChange<TData> {
	return Type.Union([
		DocumentChangeSet(data),
		DocumentChangeDelete,
	]);
}

export function isDocumentChange<TData extends TSchema>(
	data: TData,
	value: unknown,
): value is DocumentChange<TData> {
	return isDocumentChangeSet(data, value) || isDocumentChangeDelete(value);
}
