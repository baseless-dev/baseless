import {
	CollectionNotFoundError,
	CollectionReference,
	doc,
	DocumentAlreadyExistsError,
	DocumentNotFoundError,
	DocumentReference,
	InvalidCollectionReferenceError,
	InvalidDocumentIdentifierError,
} from "https://baseless.dev/x/shared/database.ts";
import type { DatabaseScanFilter } from "https://baseless.dev/x/shared/database.ts";
import { UnknownError } from "https://baseless.dev/x/shared/server.ts";
import { App } from "./app.ts";

export { collection, CollectionReference, doc, DocumentReference } from "https://baseless.dev/x/shared/database.ts";

export class Database {
	/**
	 * Construct an `Auth` object
	 * @internal
	 */
	public constructor(
		public readonly app: App,
	) {}
}

export class Document<Metadata = Record<never, never>, Data = Record<never, never>> {
	public constructor(
		public readonly ref: DocumentReference,
		public readonly metadata: Metadata,
		public readonly data?: Data,
	) {}
}

const errorMap = new Map<string, new () => Error>([
	["UnknownError", UnknownError],
	["InvalidCollectionReferenceError", InvalidCollectionReferenceError],
	["InvalidDocumentIdentifierError", InvalidDocumentIdentifierError],
	["CollectionNotFoundError", CollectionNotFoundError],
	["DocumentNotFoundError", DocumentNotFoundError],
	["DocumentAlreadyExistsError", DocumentAlreadyExistsError],
]);

function dbErrorCodeToError(errorCode: string): Error | undefined {
	if (errorMap.has(errorCode)) {
		const error = errorMap.get(errorCode)!;
		return new error();
	}
}

/**
 * Returns the Database instance associated with the provided `BaselessApp`.
 */
export function getDatabase(app: App) {
	const db = new Database(app);
	return db;
}

// https://github.com/baseless-dev/baseless/issues/14

/**
 * Creates a new Document at reference.
 *
 * Document creation can fail if server does not determine that this reference has no DatabasePermissions.Create permission.
 */
export async function createDoc<Metadata = Record<string, unknown>, Data = Record<string, unknown>>(
	db: Database,
	ref: DocumentReference,
	metadata: Metadata,
	data?: Data,
): Promise<Document<Metadata, Data>> {
	const res = await db.app.send({
		cmd: "db.create",
		ref: ref.toString(),
		metadata: metadata as Record<string, unknown>,
		data: data as Record<string, unknown>,
	});
	if ("error" in res) {
		throw dbErrorCodeToError(res["error"]);
	}
	return new Document(ref, metadata, data);
}

/**
 * Updates a new Document at reference. It leaves in place properties that aren't specified in `metadata` and `data`.
 *
 * If you want to replace the whole document, use `replaceDoc` instead.
 *
 * Document update can fail if server does not determine that this reference has no DatabasePermissions.Update permission.
 */
export async function updateDoc<Metadata = Record<string, unknown>, Data = Record<string, unknown>>(
	db: Database,
	ref: DocumentReference,
	metadata?: Partial<Metadata>,
	data?: Partial<Data>,
): Promise<void> {
	const res = await db.app.send({
		cmd: "db.update",
		ref: ref.toString(),
		metadata: metadata as Record<string, unknown>,
		data: data as Record<string, unknown>,
	});
	if ("error" in res) {
		throw dbErrorCodeToError(res["error"]);
	}
}

/**
 * Replaces a new Document at reference.
 *
 * If you want to update partially the document, use `updateDoc` instead.
 *
 * Document replace can fail if server does not determine that this reference has no DatabasePermissions.Update permission.
 */
export async function replaceDoc<Metadata = Record<string, unknown>, Data = Record<string, unknown>>(
	db: Database,
	ref: DocumentReference,
	metadata?: Metadata,
	data?: Data,
): Promise<void> {
	const res = await db.app.send({
		cmd: "db.update",
		ref: ref.toString(),
		metadata: metadata as Record<string, unknown>,
		data: data as Record<string, unknown>,
		replace: true,
	});
	if ("error" in res) {
		throw dbErrorCodeToError(res["error"]);
	}
}

/**
 * Get a list of Documents at reference.
 *
 * List can fail if server does not determine that this reference has no DatabasePermissions.List permission.
 */
export async function getDocs<Metadata = Record<string, unknown>, Data = Record<string, unknown>>(
	db: Database,
	ref: CollectionReference,
	filter?: DatabaseScanFilter<Metadata>,
): Promise<Document<Metadata, Data>[]> {
	const res = await db.app.send({ cmd: "db.list", ref: ref.toString(), filter });
	if ("error" in res) {
		throw dbErrorCodeToError(res["error"]);
	}
	if ("docs" in res) {
		return res.docs.map((data) => new Document(doc(data.ref), data.metadata as Metadata, data.data as Data));
	}
	throw new UnknownError();
}

/**
 * Get a single Document at reference.
 *
 * Get can fail if server does not determine that this reference has no DatabasePermissions.Get permission.
 */
export async function getDoc<Metadata = Record<string, unknown>, Data = Record<string, unknown>>(
	db: Database,
	ref: DocumentReference,
): Promise<Document<Metadata, Data>> {
	const res = await db.app.send({ cmd: "db.get", ref: ref.toString() });
	if ("error" in res) {
		throw dbErrorCodeToError(res["error"]);
	}
	if ("metadata" in res) {
		return new Document(ref, res.metadata as Metadata, res.data as Data);
	}
	throw new UnknownError();
}

/**
 * Delete a single Document at reference.
 *
 * Deletion can fail if server does not determine that this reference has no DatabasePermissions.Delete permission.
 */
export async function deleteDoc(
	db: Database,
	ref: DocumentReference,
): Promise<void> {
	const res = await db.app.send({
		cmd: "db.delete",
		ref: ref.toString(),
	});
	if ("error" in res) {
		throw dbErrorCodeToError(res["error"]);
	}
}
