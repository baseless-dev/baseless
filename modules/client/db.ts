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

/** */
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

/** */
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
