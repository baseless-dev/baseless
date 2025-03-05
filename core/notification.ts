import * as Type from "./schema.ts";

export interface Notification {
	subject: string;
	content: Record<string, string>;
}

export const TNotification: Type.TObject<{
	subject: Type.TString;
	content: Type.TRecord<Type.TString>;
}, ["subject", "content"]> = Type.Object(
	{
		subject: Type.String(),
		content: Type.Record(Type.String(), { minProperties: 1 }),
	},
	["subject", "content"],
	{ $id: "Notification" },
);

export class NotificationChannelNotFoundError extends Error {}
