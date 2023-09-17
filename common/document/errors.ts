export class InvalidDocumentKeyError extends Error {
	name = "InvalidDocumentKeyError" as const;
}
export class InvalidDocumentDataPrimitiveError extends Error {
	name = "InvalidDocumentDataPrimitiveError" as const;
}
export class InvalidDocumentDataObjectError extends Error {
	name = "InvalidDocumentDataObjectError" as const;
}
export class InvalidDocumentDataArrayError extends Error {
	name = "InvalidDocumentDataArrayError" as const;
}
export class InvalidDocumentDataError extends Error {
	name = "InvalidDocumentDataError" as const;
}
export class InvalidDocumentError extends Error {
	name = "InvalidDocumentError" as const;
}
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
