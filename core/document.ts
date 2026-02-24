import * as z from "./schema.ts";

/**
 * A stored document with a string `key`, arbitrary `data`, and an opaque
 * `versionstamp` used for optimistic-concurrency checks.
 */
export interface Document<TData = unknown> {
	key: string;
	data: TData;
	versionstamp: string;
}

/**
 * Creates a Zod schema for a {@link Document} with the given `data` schema.
 * When called without arguments the `data` field accepts any value.
 *
 * @example
 * ```ts
 * const TUserDoc = Document(z.object({ name: z.string() }));
 * ```
 */
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

/**
 * Options controlling the consistency level used when reading a document.
 */
export interface DocumentGetOptions {
	readonly consistency: "strong" | "eventual";
}

/** Zod schema for {@link DocumentGetOptions}. */
export const DocumentGetOptions = z.strictObject({
	consistency: z.union([z.literal("strong"), z.literal("eventual")]),
});

/**
 * Options for listing documents within a collection.
 *
 * @template TPrefix The type used for the key prefix (defaults to `string`).
 */
export interface DocumentListOptions<TPrefix = string> {
	readonly prefix: TPrefix;
	readonly cursor?: string;
	readonly limit?: number;
}

/** Zod schema for {@link DocumentListOptions}. */
export const DocumentListOptions = z.strictObject({
	prefix: z.string(),
	cursor: z.optional(z.string()),
	limit: z.optional(z.number()),
});

/**
 * A paginated entry returned by a document-list operation.
 * Pairs the continuation `cursor` with the matching {@link Document}.
 *
 * @template TData The type of the document's `data` field.
 */
export type DocumentListEntry<TData = unknown> = {
	cursor: string;
	document: Document<TData>;
};

/**
 * Creates a Zod schema for a {@link DocumentListEntry} with the given `data` schema.
 * When called without arguments the `data` field accepts any value.
 */
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

/**
 * An optimistic-concurrency check within an atomic operation.
 * Asserts that the stored `versionstamp` for `key` matches the given value
 * (or `null` to assert the document does not yet exist).
 */
export type DocumentAtomicCheck = {
	type: "check";
	readonly key: string;
	readonly versionstamp: string | null;
};

/** Zod schema for {@link DocumentAtomicCheck}. */
export const DocumentAtomicCheck = z.strictObject({
	type: z.literal("check"),
	key: z.string(),
	versionstamp: z.optional(z.union([z.string(), z.null()])),
});

/**
 * A single mutation within an atomic operation — either a `set` (upsert) or a
 * `delete`.
 */
export type DocumentAtomicOperation =
	| { type: "delete"; readonly key: string }
	| {
		type: "set";
		readonly key: string;
		readonly data: unknown;
	};

/** Zod schema for {@link DocumentAtomicOperation}. */
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

/**
 * A batch of optimistic-concurrency {@link DocumentAtomicCheck}s and
 * {@link DocumentAtomicOperation}s that are applied atomically.
 */
export interface DocumentAtomic {
	checks: DocumentAtomicCheck[];
	operations: DocumentAtomicOperation[];
}

/** Zod schema for {@link DocumentAtomic}. */
export const DocumentAtomic = z.strictObject({
	checks: z.array(DocumentAtomicCheck),
	operations: z.array(DocumentAtomicOperation),
});
