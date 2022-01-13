import {
	DatabaseScanFilter,
	IDocument,
} from "https://baseless.dev/x/provider/deno/database.ts";
import { Context } from "https://baseless.dev/x/provider/deno/context.ts";
import { logger } from "https://baseless.dev/x/logger/deno/mod.ts";
import {
	CollectionReference,
	DocumentReference,
} from "https://baseless.dev/x/shared/deno/database.ts";
import { Result } from "./schema.ts";

function refToRegExp(ref: string) {
	return new RegExp(`^${ref.replace(/:([\w]+)/g, "(?<$1>[^/]+)")}$`);
}

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
 * Database document handler
 */
export type DatabaseDocumentHandler<Metadata, Data> = (
	ctx: Context,
	doc: IDocument<Metadata, Data>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Database document change handler
 */
export type DatabaseDocumentChangeHandler<Metadata, Data> = (
	ctx: Context,
	change: IDocumentChange<Metadata, Data>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Database permission handler
 */
export type DatabasePermissionHandler =
	| DatabasePermissions
	| ((
		ctx: Context,
		params: Record<string, string>,
	) => Promise<DatabasePermissions>);

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
 * Database collection descriptor
 */
export type DatabaseCollectionDescriptor<Metadata, Data> = {
	readonly ref: string;
	readonly matcher: RegExp;
	readonly onCreate?: DatabaseDocumentHandler<Metadata, Data>;
	readonly permission?: DatabasePermissionHandler;
};

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

export const database = new DatabaseBuilder();

class Document<Metadata, Data> implements IDocument<Metadata, Data> {
	public constructor(
		public reference: DocumentReference,
		public metadata: Metadata,
		private _data: Data,
	) {}

	// deno-lint-ignore require-await
	public async data() {
		return this._data;
	}
}

export class DatabaseController {
	protected logger = logger("server/DatabaseController");

	public constructor(
		private databaseDescriptor: DatabaseDescriptor,
	) {}

	private _findCollectionDescriptor<Metadata, Data>(
		ref: string,
	):
		| [DatabaseCollectionDescriptor<Metadata, Data>, Record<string, string>]
		| undefined {
		const collections = this.databaseDescriptor.collections;
		for (const desc of collections) {
			const match = ref.match(desc.matcher);
			if (match) {
				return [desc, match.groups ?? {}];
			}
		}
		return undefined;
	}

	private _findDocumentDescriptor<Metadata, Data>(
		ref: string,
	):
		| [DatabaseDocumentDescriptor<Metadata, Data>, Record<string, string>]
		| undefined {
		const documents = this.databaseDescriptor.documents;
		for (const desc of documents) {
			const match = ref.match(desc.matcher);
			if (match) {
				return [desc, match.groups ?? {}];
			}
		}
		return undefined;
	}

	private async _getPermission(
		context: Context,
		params: Record<string, string>,
		handler?: DatabasePermissionHandler,
	) {
		if (typeof handler === "function") {
			return await handler(context, params);
		} else {
			return handler ?? DatabasePermissions.None;
		}
	}

	private _testPermission(flag: number, permission: DatabasePermissions) {
		return (flag & permission) > 0;
	}

	public async get(
		_request: Request,
		context: Context,
		reference: DocumentReference,
	): Promise<Result> {
		const result = this._findDocumentDescriptor(reference.toString());
		if (result) {
			const [desc, params] = result;
			const permission = await this._getPermission(
				context,
				params ?? {},
				desc.permission,
			);
			if ((permission & DatabasePermissions.Get) > 0) {
				try {
					const doc = await context.database.get(reference);
					return { metadata: doc.metadata, data: await doc.data() };
				} catch (err) {
					return { error: `${err}` };
				}
			}
		}
		return { error: "DocumentNotFound" };
	}

	public async create<Metadata, Data>(
		_request: Request,
		context: Context,
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
	): Promise<Result> {
		const result = this._findCollectionDescriptor(
			reference.collection.toString(),
		);
		if (result) {
			const [desc, params] = result;
			const flag = await this._getPermission(
				context,
				params ?? {},
				desc.permission,
			);
			if (this._testPermission(flag, DatabasePermissions.Create)) {
				try {
					await context.database.create(reference, metadata, data);
					if (desc.onCreate) {
						const doc = new Document(reference, metadata, data ?? {});
						await desc.onCreate(context, doc, params);
					}
					return {};
				} catch (err) {
					return { error: `${err}` };
				}
			}
		}
		return { error: "DocumentNotFound" };
	}

	public async update<Metadata, Data>(
		_request: Request,
		context: Context,
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
	): Promise<Result> {
		const result = this._findDocumentDescriptor(reference.toString());
		if (result) {
			const [desc, params] = result;
			const flag = await this._getPermission(
				context,
				params ?? {},
				desc.permission,
			);
			if (this._testPermission(flag, DatabasePermissions.Update)) {
				try {
					if (desc.onUpdate) {
						const before = await context.database.get(reference);
						await context.database.update(reference, metadata, data);
						const after = new Document(reference, metadata, data ?? {});
						await desc.onUpdate(context, { before, after }, params);
					} else {
						await context.database.update(reference, metadata, data);
					}
					return {};
				} catch (err) {
					return { error: `${err}` };
				}
			}
		}
		return { error: "DocumentNotFound" };
	}

	public async list<Metadata>(
		_request: Request,
		context: Context,
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<Result> {
		const result = this._findCollectionDescriptor(reference.toString());
		if (result) {
			const [desc, params] = result;
			const flag = await this._getPermission(context, params, desc.permission);
			if (this._testPermission(flag, DatabasePermissions.List)) {
				try {
					const docs = await context.database.list(reference, filter);
					const docsWithData = await Promise.all(
						docs.map(async (doc) => ({
							ref: doc.reference.toString(),
							metadata: doc.metadata,
							data: await doc.data(),
						})),
					);
					return { docs: docsWithData };
				} catch (err) {
					return { error: `${err}` };
				}
			}
		}
		return { error: "CollectionNotFound" };
	}

	public async delete(
		_request: Request,
		context: Context,
		reference: DocumentReference,
	): Promise<Result> {
		const result = this._findDocumentDescriptor(reference.toString());
		if (result) {
			const [desc, params] = result;
			const flag = await this._getPermission(context, params, desc.permission);
			if (this._testPermission(flag, DatabasePermissions.Delete)) {
				try {
					if (desc.onDelete) {
						const doc = await context.database.get(reference);
						await context.database.delete(reference);
						await desc.onDelete(context, doc, params);
					} else {
						await context.database.delete(reference);
					}
					return {};
				} catch (err) {
					return { error: `${err}` };
				}
			}
		}
		return { error: "DocumentNotFound" };
	}
}
