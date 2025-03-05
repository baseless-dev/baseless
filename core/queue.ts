import * as Type from "./schema.ts";

export interface QueueItem {
	type: string;
	payload: unknown;
}

export const QueueItem: Type.TObject<{
	type: Type.TString;
	payload: Type.TUnknown;
}, ["type", "payload"]> = Type.Object({
	type: Type.String(),
	payload: Type.Unknown(),
}, ["type", "payload"]);
