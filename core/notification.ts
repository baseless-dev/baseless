import * as z from "./schema.ts";

/**
 * A notification to be delivered to a user via one or more channels.
 * `subject` is a channel-agnostic title, and `content` maps content-type
 * keys (e.g. `"text/plain"`, `"text/html"`) to their rendered strings.
 */
export interface Notification {
	subject: string;
	content: Record<string, string>;
}

/** Zod schema for {@link Notification}. */
export const TNotification = z.strictObject({
	subject: z.string(),
	content: z.record(z.string(), z.string()),
}).meta({ id: "Notification" });
