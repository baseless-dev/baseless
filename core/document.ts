import * as Type from "./schema.ts";

export interface Document<TData = unknown> {
	key: string;
	data: TData;
	versionstamp: string;
}

export const Document: Type.TObject<{
	key: Type.TString;
	data: Type.TAny;
	versionstamp: Type.TString;
}, ["key", "data", "versionstamp"]> = Type.Object({
	key: Type.String(),
	data: Type.Any(),
	versionstamp: Type.String(),
}, ["key", "data", "versionstamp"]);

export interface DocumentGetOptions {
	readonly consistency: "strong" | "eventual";
}

export const DocumentGetOptions: Type.TObject<{
	consistency: Type.TUnion<[Type.TLiteral<"strong">, Type.TLiteral<"eventual">]>;
}, ["consistency"]> = Type.Object({
	consistency: Type.Union([Type.Literal("strong"), Type.Literal("eventual")]),
}, ["consistency"]);

export interface DocumentListOptions<TPrefix = string> {
	readonly prefix: TPrefix;
	readonly cursor?: string;
	readonly limit?: number;
}

export const DocumentListOptions: Type.TObject<{
	prefix: Type.TString;
	cursor: Type.TString;
	limit: Type.TNumber;
}, ["prefix"]> = Type.Object({
	prefix: Type.String(),
	cursor: Type.String(),
	limit: Type.Number(),
}, ["prefix"]);

export type DocumentListEntry<TData = unknown> = {
	cursor: string;
	document: Document<TData>;
};

export const DocumentListEntry: Type.TObject<{
	cursor: Type.TString;
	document: typeof Document;
}, ["cursor", "document"]> = Type.Object({
	cursor: Type.String(),
	document: Document,
}, ["cursor", "document"]);

export type DocumentAtomicCheck = {
	type: "check";
	readonly key: string;
	readonly versionstamp: string | null;
};

export const DocumentAtomicCheck: Type.TObject<{
	type: Type.TLiteral<"check">;
	key: Type.TString;
	versionstamp: Type.TUnion<[Type.TString, Type.TNull]>;
}, ["type", "key"]> = Type.Object({
	type: Type.Literal("check"),
	key: Type.String(),
	versionstamp: Type.Union([Type.String(), Type.Null()]),
}, ["type", "key"]);

export type DocumentAtomicOperation =
	| { type: "delete"; readonly key: string }
	| {
		type: "set";
		readonly key: string;
		readonly data: unknown;
	};

export const DocumentAtomicOperation: Type.TUnion<[
	Type.TObject<{
		type: Type.TLiteral<"delete">;
		key: Type.TString;
	}, ["type", "key"]>,
	Type.TObject<{
		type: Type.TLiteral<"set">;
		key: Type.TString;
		data: Type.TAny;
	}, ["type", "key", "data"]>,
]> = Type.Union([
	Type.Object({
		type: Type.Literal("delete"),
		key: Type.String(),
	}, ["type", "key"]),
	Type.Object({
		type: Type.Literal("set"),
		key: Type.String(),
		data: Type.Any(),
	}, ["type", "key", "data"]),
]);

export interface DocumentAtomic {
	checks: DocumentAtomicCheck[];
	operations: DocumentAtomicOperation[];
}

export const DocumentAtomic: Type.TObject<{
	checks: Type.TArray<typeof DocumentAtomicCheck>;
	operations: Type.TArray<typeof DocumentAtomicOperation>;
}, ["checks", "operations"]> = Type.Object({
	checks: Type.Array(DocumentAtomicCheck),
	operations: Type.Array(DocumentAtomicOperation),
}, ["checks", "operations"]);
