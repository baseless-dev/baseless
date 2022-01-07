import {
	CollectionReference,
	DatabaseScanFilter,
	DatabaseSetOptions,
	DocumentAlreadyExistsError,
	DocumentNotFoundError,
	DocumentReference,
	IDatabaseProvider,
	IDocument,
} from "https://baseless.dev/x/baseless/core/database.ts";
import {
	IKVProvider,
	IKVValue,
	KeyNotFoundError,
} from "https://baseless.dev/x/baseless/core/kv.ts";

const EOC = "/";

/**
 * Convert DocumentReference to key with a path termination
 */
function DocumentReferenceToKey(path: DocumentReference) {
	return `${path.collection.toString()}/${EOC}${path.id}`;
}

/**
 * Convert a key to a DocumentReference without the path termination
 */
function keyToDocumentReference(key: string) {
	const segments = key.split("/");
	const collection = segments.slice(1, -2);
	const id = segments.pop();
	return new DocumentReference(new CollectionReference(...collection), id);
}

/**
 * Document
 */
export class Document<Metadata, Data> implements IDocument<Metadata, Data> {
	/**
	 * Construct a Document from an underlying IKVValue
	 */
	constructor(
		public reference: DocumentReference,
		protected value: IKVValue<Metadata>,
	) {}

	/**
	 * Metadata of the document
	 */
	public get metadata() {
		return this.value.metadata;
	}

	/**
	 * Retrieve the underlying document's data
	 */
	public data(): Promise<Data> {
		return this.value.data().then((data) => {
			if (typeof data === "string") {
				return JSON.parse(data);
			} else if (
				typeof ReadableStream !== "undefined" && data instanceof ReadableStream
			) {
				return new Response(data).text().then((text) => JSON.parse(text));
			} else if (
				typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer
			) {
				return JSON.parse(new TextDecoder().decode(data));
			} else {
				return {};
			}
		});
	}
}

/**
 * Database provider backed by an IKVProvider
 */
export class DatabaseOnKvProvider implements IDatabaseProvider {
	/**
	 * Construct a new DatabaseOnKvProvider backed by an IKVProvider
	 */
	constructor(protected backend: IKVProvider) {}

	/**
	 * Retrieve a single document
	 */
	get<Metadata, Data>(
		reference: DocumentReference,
	): Promise<IDocument<Metadata, Data>> {
		const key = DocumentReferenceToKey(reference);
		return this.backend.get<Metadata>(key).then((value) =>
			new Document(reference, value)
		);
	}

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<IDocument<Metadata, Data>[]> {
		const prefix = `${reference}/${EOC}`;
		return this.backend
			.list(prefix, filter)
			.then((values) =>
				values.map((value) =>
					new Document(keyToDocumentReference(value.key), value)
				)
			);
	}

	/**
	 * Create a document
	 */
	create<Metadata, Data>(
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
		options?: DatabaseSetOptions,
	): Promise<void> {
		const key = DocumentReferenceToKey(reference);
		return this.backend.get(key)
			.then(() => {
				throw new DocumentAlreadyExistsError(reference.toString());
			})
			.catch((err) => {
				if (err instanceof KeyNotFoundError) {
					return this.backend.set(key, metadata, JSON.stringify(data), options);
				}
				return err;
			});
	}

	/**
	 * Update a document
	 */
	update<Metadata, Data>(
		reference: DocumentReference,
		metadata: Partial<Metadata>,
		data?: Partial<Data>,
		options?: DatabaseSetOptions,
	): Promise<void> {
		const key = DocumentReferenceToKey(reference);
		return this.get(reference)
			.then(async (doc) =>
				this.backend.set(
					key,
					{ ...doc.metadata, ...metadata },
					JSON.stringify({ ...await doc.data(), ...data }),
					options,
				)
			)
			.catch((err) => {
				if (err instanceof KeyNotFoundError) {
					throw new DocumentNotFoundError(reference.toString());
				}
				return err;
			});
	}

	/**
	 * Delete a document
	 */
	delete(reference: DocumentReference): Promise<void> {
		const key = DocumentReferenceToKey(reference);
		return this.backend.delete(key);
	}
}
