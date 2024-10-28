import { type TObject, type TRecord, type TString, Type } from "@sinclair/typebox";

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
