/**
 * @module
 * Browser/server SDK for Baseless — provides {@link Client}, {@link Credentials},
 * typed document, pubsub, and authentication helpers.
 */
export * from "./client.ts";
export * from "./credentials.ts";
export * from "./errors.ts";
export type { Document, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";
export type {
	StorageDownloadOptions,
	StorageListEntry,
	StorageListOptions,
	StorageObject,
	StorageSignedUrl,
	StorageUploadOptions,
} from "@baseless/core/storage";
export type { ID } from "@baseless/core/id";
export * as z from "@baseless/core/schema";
