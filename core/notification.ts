import * as z from "./schema.ts";

export interface Notification {
	subject: string;
	content: Record<string, string>;
}

export const TNotification = z.strictObject({
	subject: z.string(),
	content: z.record(z.string(), z.string()),
}).meta({ id: "Notification" });
