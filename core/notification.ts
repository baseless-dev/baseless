import * as t from "./schema.ts";

export interface Notification {
	subject: string;
	content: Record<string, string>;
}

export const TNotification: t.TObject<{
	subject: t.TString;
	content: t.TRecord<t.TString>;
}, ["subject", "content"]> = t.Object(
	{
		subject: t.String(),
		content: t.Record(t.String(), { minProperties: 1 }),
	},
	["subject", "content"],
	{ $id: "Notification" },
);

export class NotificationChannelNotFoundError extends Error {}
