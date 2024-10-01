import { TArray, TLiteral, TObject, TString, TUnknown, Type } from "@sinclair/typebox";

export interface Event {
	kind: "event";
	event: string[];
	payload: unknown;
}

export const Event: TObject<{
	kind: TLiteral<"event">;
	event: TArray<TString>;
	payload: TUnknown;
}> = Type.Object({
	kind: Type.Literal("event"),
	event: Type.Array(Type.String()),
	payload: Type.Unknown(),
}, { $id: "Event" });

export function isEvent(value: unknown): value is Event {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "event" && "event" in value && Array.isArray(value.event) && value.event.every((v) => typeof v === "string") &&
		"payload" in value;
}
