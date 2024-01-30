import { type Static, t } from "../../deps.ts";

export type DocumentKey = string[];
export type DocumentData = unknown;

export const DocumentSchema = t.Object({
	key: t.Array(t.String()),
	data: t.Unknown(),
	versionstamp: t.String(),
}, { $id: "Document" });

export type Document = Static<typeof DocumentSchema>;
