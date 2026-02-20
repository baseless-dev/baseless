import * as z from "./schema.ts";

export interface Document<TData = unknown> {
	key: string;
	data: TData;
	versionstamp: string;
}

export function Document<TData extends z.ZodType>(data: TData): z.ZodObject<{
	key: z.ZodString;
	data: TData;
	versionstamp: z.ZodString;
}>;
export function Document(): z.ZodObject<{
	key: z.ZodString;
	data: z.ZodAny;
	versionstamp: z.ZodString;
}>;
export function Document(data?: z.ZodType): z.ZodObject<{
	key: z.ZodString;
	data: z.ZodType;
	versionstamp: z.ZodString;
}> {
	return z.strictObject({
		key: z.string(),
		data: data ?? z.any(),
		versionstamp: z.string(),
	});
}

export interface DocumentGetOptions {
	readonly consistency: "strong" | "eventual";
}

export const DocumentGetOptions = z.strictObject({
	consistency: z.union([z.literal("strong"), z.literal("eventual")]),
});

export interface DocumentListOptions<TPrefix = string> {
	readonly prefix: TPrefix;
	readonly cursor?: string;
	readonly limit?: number;
}

export const DocumentListOptions = z.strictObject({
	prefix: z.string(),
	cursor: z.optional(z.string()),
	limit: z.optional(z.number()),
});

export type DocumentListEntry<TData = unknown> = {
	cursor: string;
	document: Document<TData>;
};

export function DocumentListEntry<TData extends z.ZodType>(data: TData): z.ZodObject<{
	cursor: z.ZodString;
	document: ReturnType<typeof Document<TData>>;
}>;
export function DocumentListEntry(): z.ZodObject<{
	cursor: z.ZodString;
	document: z.ZodAny;
}>;
export function DocumentListEntry(data?: z.ZodType): z.ZodObject<{
	cursor: z.ZodString;
	document: z.ZodType;
}> {
	return z.strictObject({
		cursor: z.string(),
		document: data ? Document(data) : Document(),
	});
}

export type DocumentAtomicCheck = {
	type: "check";
	readonly key: string;
	readonly versionstamp: string | null;
};

export const DocumentAtomicCheck = z.strictObject({
	type: z.literal("check"),
	key: z.string(),
	versionstamp: z.optional(z.union([z.string(), z.null()])),
});

export type DocumentAtomicOperation =
	| { type: "delete"; readonly key: string }
	| {
		type: "set";
		readonly key: string;
		readonly data: unknown;
	};

export const DocumentAtomicOperation = z.union([
	z.strictObject({
		type: z.literal("delete"),
		key: z.string(),
	}),
	z.strictObject({
		type: z.literal("set"),
		key: z.string(),
		data: z.any(),
	}),
]);

export interface DocumentAtomic {
	checks: DocumentAtomicCheck[];
	operations: DocumentAtomicOperation[];
}

export const DocumentAtomic = z.strictObject({
	checks: z.array(DocumentAtomicCheck),
	operations: z.array(DocumentAtomicOperation),
});
