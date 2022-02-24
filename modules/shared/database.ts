import { autoid } from "./autoid.ts";
import { KVScanFilter } from "./kv.ts";

/**
 * Alias of KVScanFilter
 */
export type DatabaseScanFilter<Model> = KVScanFilter<Model>;

/**
 * Collection reference
 */
export class CollectionReference {
	public segments: string[];

	public constructor(...segments: string[]) {
		if (
			// Must have an even number of segments
			segments.length % 2 == 0 ||
			// All segment must contain something
			segments.some((s) => s.length === 0)
		) {
			throw new InvalidCollectionReferenceError();
		}
		this.segments = segments;
	}

	public toString() {
		return `/${this.segments.join("/")}`;
	}
}

/**
 * Create a CollectionReference
 */
export function collection(...segments: string[]) {
	if (segments.length === 1 && segments[0][0] === "/") {
		segments = segments[0].replace(/^\//, "").replace(/\/$/, "").split("/");
	}
	return new CollectionReference(...segments);
}

/**
 * Document reference
 */
export class DocumentReference {
	public readonly id: string;

	constructor(
		public readonly collection: CollectionReference,
		id?: string,
	) {
		if (!id) {
			id = autoid();
		}
		if (!id?.trim() || id.match(/[/]/)) {
			throw new InvalidDocumentIdentifierError();
		}
		this.id = id;
	}

	toString() {
		return `${this.collection.toString()}/${this.id}`;
	}
}

/**
 * Create a DocumentReference
 */
export function doc(...segments: string[]): DocumentReference;
export function doc(collection: CollectionReference): DocumentReference;
export function doc(
	collection: CollectionReference,
	id: string,
): DocumentReference;
export function doc(
	collection: string | CollectionReference,
	...segments: string[]
) {
	if (collection instanceof CollectionReference) {
		return segments.length ? new DocumentReference(collection, segments[0]) : new DocumentReference(collection);
	}
	segments.unshift(collection);
	if (segments.length === 1 && segments[0][0] === "/") {
		segments = segments[0].replace(/^\//, "").replace(/\/$/, "").split("/");
	}
	const id = segments.pop()!;
	return new DocumentReference(new CollectionReference(...segments), id);
}

/**
 * Invalid collection path error
 */
export class InvalidCollectionReferenceError extends Error {
	public name = "InvalidCollectionReferenceError";
}

/**
 * Invalid document identifier error
 */
export class InvalidDocumentIdentifierError extends Error {
	public name = "InvalidDocumentIdentifierError";
}

/**
 * Collection not found error
 */
export class CollectionNotFoundError extends Error {
	public name = "CollectionNotFoundError";
}

/**
 * Document not found error
 */
export class DocumentNotFoundError extends Error {
	public name = "DocumentNotFoundError";
}

/**
 * Document already exists error
 */
export class DocumentAlreadyExistsError extends Error {
	public name = "DocumentAlreadyExistsError";
}
