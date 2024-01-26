import { t } from "../deps.ts";

export const DocumentDataPrimitive = t.Union([
	t.String(),
	t.Number(),
	t.Boolean(),
	t.Null(),
], { $id: "DocumentDataPrimitive" });

export const DocumentData = t.Recursive((self) =>
	t.Union([
		DocumentDataPrimitive,
		t.Array(self),
		t.Record(t.String(), self),
	], { $id: "DocumentData" })
);

export const Document = t.Object({
	key: t.Array(t.String()),
	data: DocumentData,
	versionstamp: t.String(),
}, { $id: "Document" });

export class DocumentNotFoundError extends Error {
	name = "DocumentNotFoundError" as const;
}
export class DocumentCreateError extends Error {
	name = "DocumentCreateError" as const;
}
export class DocumentUpdateError extends Error {
	name = "DocumentUpdateError" as const;
}
export class DocumentPatchError extends Error {
	name = "DocumentPatchError" as const;
}
export class DocumentDeleteError extends Error {
	name = "DocumentDeleteError" as const;
}
export class DocumentAtomicError extends Error {
	name = "DocumentAtomicError" as const;
}
