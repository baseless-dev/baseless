import * as z from "./schema.ts";

export interface QueueItem {
	type: string;
	payload: unknown;
}

export const QueueItem = z.strictObject({
	type: z.string(),
	payload: z.unknown(),
}).meta({ id: "QueueItem" });
