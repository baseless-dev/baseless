import * as z from "./schema.ts";

/**
 * Metadata for a stored file (object) in a storage provider.
 */
export interface StorageObject {
	key: string;
	contentType: string;
	size: number;
	lastModified: string;
	metadata: Record<string, string>;
	etag: string;
}

/**
 * Creates a Zod schema for a {@link StorageObject}.
 */
export function StorageObject(): z.ZodObject<{
	key: z.ZodString;
	contentType: z.ZodString;
	size: z.ZodNumber;
	lastModified: z.ZodString;
	metadata: z.ZodRecord<z.ZodString, z.ZodString>;
	etag: z.ZodString;
}> {
	return z.strictObject({
		key: z.string(),
		contentType: z.string(),
		size: z.number(),
		lastModified: z.string(),
		metadata: z.record(z.string(), z.string()),
		etag: z.string(),
	});
}

/**
 * Options for listing files within a folder.
 *
 * @template TPrefix The type used for the key prefix (defaults to `string`).
 */
export interface StorageListOptions<TPrefix = string> {
	readonly prefix: TPrefix;
	readonly cursor?: string;
	readonly limit?: number;
	readonly signal?: AbortSignal;
}

/** Zod schema for {@link StorageListOptions}. */
export const StorageListOptions = z.strictObject({
	prefix: z.string(),
	cursor: z.optional(z.string()),
	limit: z.optional(z.number()),
	signal: z.optional(z.instanceof(AbortSignal)),
});

/**
 * A paginated entry returned by a storage list operation.
 * Pairs the continuation `cursor` with the matching {@link StorageObject}.
 */
export type StorageListEntry = {
	cursor: string;
	object: StorageObject;
};

/**
 * Creates a Zod schema for a {@link StorageListEntry}.
 */
export function StorageListEntry(): z.ZodObject<{
	cursor: z.ZodString;
	object: ReturnType<typeof StorageObject>;
}> {
	return z.strictObject({
		cursor: z.string(),
		object: StorageObject(),
	});
}

/**
 * A pre-signed URL with its expiration timestamp.
 */
export interface StorageSignedUrl {
	url: string;
	expiresAt: string;
}

/** Zod schema for {@link StorageSignedUrl}. */
export function StorageSignedUrl(): z.ZodObject<{
	url: z.ZodString;
	expiresAt: z.ZodString;
}> {
	return z.strictObject({
		url: z.string(),
		expiresAt: z.string(),
	});
}

/**
 * Options for requesting a signed upload URL.
 */
export interface StorageSignedUploadUrlOptions {
	readonly contentType?: string;
	readonly metadata?: Record<string, string>;
	readonly expirySeconds?: number;
	/**
	 * Server-enforced upload conditions as key-value pairs.
	 *
	 * Well-known keys:
	 * - `content-type` — comma-separated list of allowed MIME types
	 *   (e.g. `"image/png,image/jpeg"`).
	 * - `content-length-range` — max size or min-max range in bytes
	 *   (e.g. `"5242880"` or `"0-5242880"`).
	 *
	 * Providers that support pre-signed URL policies (S3, R2, GCS …) should
	 * embed these conditions in the policy document.
	 */
	readonly conditions?: {
		accept?: string[];
		contentLengthRange?: { min?: number; max?: number };
	};
	readonly signal?: AbortSignal;
}

/** Zod schema for {@link StorageSignedUploadUrlOptions}. */
export const StorageSignedUploadUrlOptions = z.strictObject({
	contentType: z.optional(z.string()),
	metadata: z.optional(z.record(z.string(), z.string())),
	expirySeconds: z.optional(z.number()),
	conditions: z.optional(z.record(z.string(), z.string())),
	signal: z.optional(z.instanceof(AbortSignal)),
});

/**
 * Options for uploading a file to storage.
 */
export interface StoragePutOptions {
	contentType: string;
	metadata: Record<string, string>;
	etag: string;
	signal?: AbortSignal;
}

/**
 * Creates a Zod schema for a {@link StoragePutOptions}.
 */
export function StoragePutOptions(): z.ZodObject<{
	contentType: z.ZodString;
	metadata: z.ZodRecord<z.ZodString, z.ZodString>;
	etag: z.ZodString;
	signal: z.ZodOptional<z.ZodCustom<AbortSignal>>;
}> {
	return z.strictObject({
		contentType: z.string(),
		metadata: z.record(z.string(), z.string()),
		etag: z.string(),
		signal: z.optional(z.instanceof(AbortSignal)),
	});
}

/**
 * Options for requesting a signed download URL.
 */
export interface StorageSignedDownloadUrlOptions {
	readonly expirySeconds?: number;
	readonly signal?: AbortSignal;
}

/** Zod schema for {@link StorageSignedDownloadUrlOptions}. */
export const StorageSignedDownloadUrlOptions = z.strictObject({
	expirySeconds: z.optional(z.number()),
});
