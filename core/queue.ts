import * as z from "./schema.ts";
import { StorageObject } from "@baseless/core/storage";

/**
 * A queue item represents a unit of work to be processed, such as publishing a topic
 */
export interface QueueItemTopicPublish {
	type: "topic_publish";
	key: string;
	payload: unknown;
}

/** Zod schema for {@link QueueItemTopicPublish}. */
export const QueueItemTopicPublish = z.strictObject({
	type: z.literal("topic_publish"),
	key: z.string(),
	payload: z.unknown(),
});

/**
 * A queue item representing a file upload event, containing the key and metadata of the uploaded file.
 */
export interface QueueItemFileUploaded {
	type: "file_uploaded";
	key: string;
	file: StorageObject;
}

/** Zod schema for {@link QueueItemFileUploaded}. */
export const QueueItemFileUploaded = z.strictObject({
	type: z.literal("file_uploaded"),
	key: z.string(),
	file: StorageObject(),
});

/**
 * A queue item representing a file upload event, containing the key and metadata of the uploaded file.
 */
export interface QueueItemFileDeleted {
	type: "file_deleted";
	key: string;
	file: StorageObject;
}

/** Zod schema for {@link QueueItemFileDeleted}. */
export const QueueItemFileDeleted = z.strictObject({
	type: z.literal("file_deleted"),
	key: z.string(),
	file: StorageObject(),
});

/** Zod schema for {@link QueueItem}. */
export const QueueItem = z.discriminatedUnion("type", [
	QueueItemTopicPublish,
	QueueItemFileDeleted,
	QueueItemFileUploaded,
]);

/** TypeScript type for a queue item, derived from the Zod schema. */
export type QueueItem = QueueItemTopicPublish | QueueItemFileDeleted | QueueItemFileUploaded;
