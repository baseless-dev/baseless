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
