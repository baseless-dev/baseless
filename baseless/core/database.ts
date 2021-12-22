import { KVScanFilter, KVSetOptions } from "./kv.ts";
import { IContext } from "./context.ts";
import { autoid } from "./autoid.ts";
import { NoopServiceError } from "./mod.ts";

/**
 * Invalid collection path error
 */
export class InvalidCollectionReferenceError extends Error {
	public name = "InvalidCollectionReferenceError";
	public constructor(reference: string) {
		super(`Invalid collection path '${reference}'.`);
	}
}

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
			throw new InvalidCollectionReferenceError(`/${segments.join("/")}`);
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
 * Unique identifier of the document
 */
export type DocumentIdentifier = string;

/**
 * Invalid document identifier error
 */
export class InvalidDocumentIdentifierError extends Error {
	public name = "InvalidDocumentIdentifierError";
	public constructor(id: string) {
		super(`Invalid document identifier '${id}'.`);
	}
}

/**
 * Document reference
 */
export class DocumentReference {
	public readonly id: DocumentIdentifier;

	constructor(
		public readonly collection: CollectionReference,
		id?: DocumentIdentifier,
	) {
		if (!id) {
			id = autoid();
		}
		if (!id?.trim() || id.match(/[/]/)) {
			throw new InvalidDocumentIdentifierError(id ?? "");
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
		return segments.length
			? new DocumentReference(collection, segments[0])
			: new DocumentReference(collection);
	}
	segments.unshift(collection);
	if (segments.length === 1 && segments[0][0] === "/") {
		segments = segments[0].replace(/^\//, "").replace(/\/$/, "").split("/");
	}
	const id = segments.pop()!;
	return new DocumentReference(new CollectionReference(...segments), id);
}

/**
 * Document
 */
export interface IDocument<Metadata, Data> {
	/**
	 * Reference to this document
	 */
	reference: DocumentReference;

	/**
	 * Metadata of the document
	 */
	metadata: Partial<Metadata>;

	/**
	 * Retrieve the underlying document's data
	 */
	data(): Promise<Partial<Data>>;
}

/**
 * Document changes
 */
export interface IDocumentChange<Metadata, Data> {
	/**
	 * Previous data before the changes
	 */
	before: IDocument<Metadata, Data>;

	/**
	 * Actualized data after the changes
	 */
	after: IDocument<Metadata, Data>;
}

/**
 * Database descriptor
 */
export type DatabaseDescriptor = {
	readonly collections: ReadonlyArray<
		DatabaseCollectionDescriptor<unknown, unknown>
	>;
	readonly documents: ReadonlyArray<
		DatabaseDocumentDescriptor<unknown, unknown>
	>;
};

/**
 * Database builder
 */
export class DatabaseBuilder {
	private collections = new Set<DatabaseCollectionBuilder>();
	private documents = new Set<DatabaseDocumentBuilder>();

	/**
	 * Build the database descriptor
	 */
	public build(): DatabaseDescriptor {
		return {
			collections: Array.from(this.collections).map((b) => b.build()),
			documents: Array.from(this.documents).map((b) => b.build()),
		};
	}

	/**
	 * Create a collection descriptor
	 */
	public collection(reference: string) {
		const builder = new DatabaseCollectionBuilder(reference);
		this.collections.add(builder);
		return builder;
	}

	/**
	 * Create a document descriptor
	 */
	public document(reference: string) {
		const builder = new DatabaseDocumentBuilder(reference);
		this.documents.add(builder);
		return builder;
	}
}

function refToRegExp(ref: string) {
	return new RegExp(`^${ref.replace(/\{([\w]+)\}/g, "(?<$1>[^/]+)")}$`);
}

/**
 * Database document handler
 */
export type DatabaseDocumentHandler<Metadata, Data> = (
	ctx: IContext,
	doc: IDocument<Metadata, Data>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Database document change handler
 */
export type DatabaseDocumentChangeHandler<Metadata, Data> = (
	ctx: IContext,
	change: IDocumentChange<Metadata, Data>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Database permission
 */
export enum DatabasePermissions {
	None = 0,
	List = 1,
	Get = 2,
	Create = 4,
	Update = 8,
	Delete = 16,
	Subscribe = 32,
}

/**
 * Database permission handler
 */
export type DatabasePermissionHandler =
	| DatabasePermissions
	| ((
		ctx: IContext,
		params: Record<string, string>,
	) => Promise<DatabasePermissions>);

/**
 * Database collection descriptor
 */
export type DatabaseCollectionDescriptor<Metadata, Data> = {
	readonly ref: string;
	readonly matcher: RegExp;
	readonly onCreate?: DatabaseDocumentHandler<Metadata, Data>;
	readonly permission?: DatabasePermissionHandler;
};

/**
 * Database collection descriptor
 */
export class DatabaseCollectionBuilder<Metadata = unknown, Data = unknown> {
	private onCreateHandler?: DatabaseDocumentHandler<Metadata, Data>;
	private permissionHandler?: DatabasePermissionHandler;

	/**
	 * Construct a new Database document builder
	 */
	public constructor(private ref: string) {}

	/**
	 * Build the database collection descriptor
	 */
	public build(): DatabaseCollectionDescriptor<Metadata, Data> {
		return {
			ref: this.ref,
			matcher: refToRegExp(this.ref),
			onCreate: this.onCreateHandler,
			permission: this.permissionHandler,
		};
	}

	/**
	 * Set the create handler
	 */
	public onCreate(handler: DatabaseDocumentHandler<unknown, unknown>) {
		this.onCreateHandler = handler;
		return this;
	}

	/**
	 * Set the security policy handler
	 */
	public permission(handler: DatabasePermissionHandler) {
		this.permissionHandler = handler;
		return this;
	}
}

/**
 * Database document descriptor
 */
export type DatabaseDocumentDescriptor<Metadata, Data> = {
	readonly ref: string;
	readonly matcher: RegExp;
	readonly onUpdate?: DatabaseDocumentChangeHandler<Metadata, Data>;
	readonly onDelete?: DatabaseDocumentHandler<Metadata, Data>;
	readonly permission?: DatabasePermissionHandler;
};

/**
 * Database document builder
 */
export class DatabaseDocumentBuilder<Metadata = unknown, Data = unknown> {
	private onUpdateHandler?: DatabaseDocumentChangeHandler<Metadata, Data>;
	private onDeleteHandler?: DatabaseDocumentHandler<Metadata, Data>;
	private permissionHandler?: DatabasePermissionHandler;

	/**
	 * Construct a new Database document builder
	 */
	public constructor(private ref: string) {}

	/**
	 * Build the database document descriptor
	 */
	public build(): DatabaseDocumentDescriptor<Metadata, Data> {
		return {
			ref: this.ref,
			matcher: refToRegExp(this.ref),
			onUpdate: this.onUpdateHandler,
			onDelete: this.onDeleteHandler,
			permission: this.permissionHandler,
		};
	}

	/**
	 * Set the update handler
	 */
	public onUpdate(handler: DatabaseDocumentChangeHandler<Metadata, Data>) {
		this.onUpdateHandler = handler;
		return this;
	}

	/**
	 * Set the update handler
	 */
	public onDelete(handler: DatabaseDocumentHandler<Metadata, Data>) {
		this.onDeleteHandler = handler;
		return this;
	}

	/**
	 * Set the security policy handler
	 */
	public permission(handler: DatabasePermissionHandler) {
		this.permissionHandler = handler;
		return this;
	}
}

/**
 * Alias of KVScanFilter
 */
export type DatabaseScanFilter<Model> = KVScanFilter<Model>;

/**
 * Alias of KVSetOptions
 */
export type DatabaseSetOptions = KVSetOptions;

/**
 * Document not found error
 */
export class DocumentNotFoundError extends Error {
	public name = "DocumentNotFoundError";
	public constructor(path: string) {
		super(`Document '${path}' not found.`);
	}
}

/**
 * Document already exists error
 */
export class DocumentAlreadyExistsError extends Error {
	public name = "DocumentAlreadyExistsError";
	public constructor(path: string) {
		super(`Document '${path}' already exists.`);
	}
}

/**
 * Database service
 */
export interface IDatabaseProvider {
	/**
	 * Retrieve a single document from the database
	 */
	get<Metadata, Data>(
		reference: DocumentReference,
	): Promise<IDocument<Metadata, Data>>;

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<IDocument<Metadata, Data>[]>;

	/**
	 * Create a document
	 */
	create<Metadata, Data>(
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
		options?: DatabaseSetOptions,
	): Promise<void>;

	/**
	 * Update a document
	 */
	update<Metadata, Data>(
		reference: DocumentReference,
		metadata: Partial<Metadata>,
		data?: Partial<Data>,
		options?: DatabaseSetOptions,
	): Promise<void>;

	/**
	 * Delete a document
	 */
	delete(reference: DocumentReference): Promise<void>;
}

/**
 * Database service
 */
export interface IDatabaseService {
	/**
	 * Retrieve a single document from the database
	 */
	get<Metadata, Data>(
		reference: DocumentReference,
	): Promise<IDocument<Metadata, Data>>;

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<IDocument<Metadata, Data>[]>;

	/**
	 * Create a document
	 */
	create<Metadata, Data>(
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
		options?: DatabaseSetOptions,
	): Promise<void>;

	/**
	 * Update a document
	 */
	update<Metadata, Data>(
		reference: DocumentReference,
		metadata: Partial<Metadata>,
		data?: Partial<Data>,
		options?: DatabaseSetOptions,
	): Promise<void>;

	/**
	 * Delete a document
	 */
	delete(reference: DocumentReference): Promise<void>;
}

/**
 * Database service backed by an IKVProvider
 */
export class DatabaseService implements IDatabaseService {
	/**
	 * Construct a new DatabaseService backed by an IDatabaseProvider
	 */
	constructor(protected backend: IDatabaseProvider) {}

	/**
	 * Retrieve a single document
	 */
	get<Metadata, Data>(
		reference: DocumentReference,
	): Promise<IDocument<Metadata, Data>> {
		return this.backend.get(reference);
	}

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<IDocument<Metadata, Data>[]> {
		return this.backend.list(reference, filter);
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
		return this.backend.create(reference, metadata, data, options);
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
		return this.backend.update(reference, metadata, data, options);
	}

	/**
	 * Delete a document
	 */
	delete(reference: DocumentReference): Promise<void> {
		return this.backend.delete(reference);
	}
}

/**
 * Noop database service backed by an IKVProvider
 */
export class NoopDatabaseService implements IDatabaseService {
	/**
	 * Retrieve a single document
	 */
	get<Metadata, Data>(): Promise<IDocument<Metadata, Data>> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(): Promise<IDocument<Metadata, Data>[]> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Create a document
	 */
	create(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Update a document
	 */
	update(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Delete a document
	 */
	delete(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}
}

/**
 * Cached Document
 */
export class CachedDocument<Metadata, Data>
	implements IDocument<Metadata, Data> {
	public constructor(
		public reference: DocumentReference,
		public metadata: Metadata,
		protected _data: Data,
	) {}

	public data(): Promise<Data> {
		return Promise.resolve(this._data);
	}
}

/**
 * Database service with in-memory cache
 */
export class CachableDatabaseService implements IDatabaseService {
	protected cache = new Map<string, IDocument<unknown, unknown>>();

	/**
	 * Construct a new DatabaseService backed by an IKVProvider
	 * @param backend IKVProvider backend
	 */
	constructor(protected backend: IDatabaseService) {}

	/**
	 * Retrieve a single document
	 */
	get<Metadata, Data>(
		reference: DocumentReference,
	): Promise<IDocument<Metadata, Data>> {
		const key = reference.toString();
		if (this.cache.has(key)) {
			return Promise.resolve(this.cache.get(key)!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
		}
		return this.backend.get(reference).then((doc) => {
			this.cache.set(key, doc);
			return doc;
		});
	}

	/**
	 * Retrieve documents at prefix
	 */
	list<Metadata, Data>(
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<IDocument<Metadata, Data>[]> {
		return this.backend.list(reference, filter).then((docs) => {
			for (const doc of docs) {
				this.cache.set(doc.reference.toString(), doc);
			}
			return docs;
		});
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
		return this.backend.create(reference, metadata, data, options).then(() => {
			const doc = new CachedDocument<Metadata, Data>(
				reference,
				metadata,
				data as Data,
			);
			this.cache.set(reference.toString(), doc);
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
		return this.backend.update(reference, metadata, data, options).then(() => {
			this.cache.delete(reference.toString());
		});
	}

	/**
	 * Delete a document
	 */
	delete(reference: DocumentReference): Promise<void> {
		return this.backend.delete(reference).then(() => {
			this.cache.delete(reference.toString());
		});
	}
}
