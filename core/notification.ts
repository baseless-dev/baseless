import { type TObject, type TRecord, type TString, type TUnknown, Type } from "@sinclair/typebox";

export interface NotificationTransport {
	kind: string;
	value: unknown;
}

export const NotificationTransport: TObject<{
	kind: TString;
	value: TUnknown;
}> = Type.Object({
	kind: Type.String(),
	value: Type.Unknown(),
}, { $id: "NotificationTransport" });

export function isNotificationTransport(value: unknown): value is NotificationTransport {
	return !!value && typeof value === "object" && "kind" in value &&
		typeof value.kind === "string" && "value" in value;
}

export interface Notification {
	subject: string;
	content: Record<string, string>;
}

export const Notification: TObject<{
	subject: TString;
	content: TRecord<TString, TString>;
}> = Type.Object({
	subject: Type.String(),
	content: Type.Record(Type.String(), Type.String(), { minProperties: 1 }),
}, { $id: "Notification" });

export function isNotification(value: unknown): value is Notification {
	return !!value && typeof value === "object" && "subject" in value &&
		typeof value.subject === "string" && "content" in value &&
		typeof value.content === "object";
}
