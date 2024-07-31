import { Type } from "@sinclair/typebox";

export interface Document {
	key: string[];
	data: unknown;
	versionstamp: string;
}

export const Document = Type.Object({
	key: Type.Array(Type.String()),
	data: Type.Unknown(),
	versionstamp: Type.String(),
}, { $id: "Document" });

export function isDocument(value: unknown): value is Document {
	return !!value && typeof value === "object" && "key" in value && Array.isArray(value.key) &&
		value.key.every((s) => typeof s === "string") && "data" in value &&
		"versionstamp" in value && typeof value.versionstamp === "string";
}
