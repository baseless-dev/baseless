import * as z from "./schema.ts";

/**
 * A message enqueued for asynchronous processing.
 * `type` discriminates the payload shape; `payload` carries arbitrary data.
 */
export interface QueueItem {
	type: string;
	payload: unknown;
}

/** Zod schema for {@link QueueItem}. */
export const QueueItem = z.strictObject({
	type: z.string(),
	payload: z.unknown(),
}).meta({ id: "QueueItem" });
