import { IDocument } from "https://baseless.dev/x/provider/database.ts";
import { Context } from "https://baseless.dev/x/provider/context.ts";
import { CollectionReference, DocumentReference } from "https://baseless.dev/x/shared/database.ts";

function refToRegExp(ref: string) {
	return new RegExp(`^${ref.replace(/:([\w]+)/g, "(?<$1>[^/]+)")}$`);
}

/**
 * Database collection permission
 */
export enum DatabaseCollectionPermissions {
	None = 0,
	List = 1,
	Create = 2,
	Subscribe = 4,
}

/**
 * Database document permission
 */
export enum DatabaseDocumentPermissions {
	None = 0,
	Get = 1,
	Update = 2,
	Delete = 4,
	Subscribe = 8,
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
	context: Context,
	document: IDocument<Metadata, Data>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Database document change handler
 */
export type DatabaseDocumentChangeHandler<Metadata, Data> = (
	context: Context,
	change: IDocumentChange<Metadata, Data>,
	params: Record<string, string>,
) => Promise<void>;

/**
 * Database permission handler
 */
export type DatabaseCollectionPermissionHandler =
	| DatabaseCollectionPermissions
	| ((
		context: Context,
		params: Record<string, string>,
	) => Promise<DatabaseCollectionPermissions>);

/**
 * Database permission handler
 */
export type DatabaseDocumentPermissionHandler =
	| DatabaseDocumentPermissions
	| ((
		context: Context,
		params: Record<string, string>,
	) => Promise<DatabaseDocumentPermissions>);

/**
 * Database descriptor
 */
export class DatabaseDescriptor {
	public constructor(
		public readonly collections: ReadonlyArray<DatabaseCollectionDescriptor>,
		public readonly documents: ReadonlyArray<DatabaseDocumentDescriptor>,
	) {}

	public getCollectionDescriptor(
		reference: string,
	): [DatabaseCollectionDescriptor, Record<string, string>] | undefined {
		for (const collection of this.collections) {
			const groups = collection.match(reference);
			if (groups) {
				return [collection, groups];
			}
		}
	}

	public getDocumentDescriptor(reference: string): [DatabaseDocumentDescriptor, Record<string, string>] | undefined {
		for (const document of this.documents) {
			const groups = document.match(reference);
			if (groups) {
				return [document, groups];
			}
		}
	}
}

/**
 * Database collection descriptor
 */
export class DatabaseCollectionDescriptor {
	public constructor(
		public readonly reference: string,
		private readonly onCreateHandler?: DatabaseDocumentHandler<unknown, unknown>,
		private readonly permissionHandler?: DatabaseCollectionPermissionHandler,
	) {
		this.matcher = refToRegExp(reference);
	}

	private matcher: RegExp;

	public match(reference: string): undefined | Record<string, string> {
		const match = reference.match(this.matcher);
		if (match) {
			return match.groups ?? {};
		}
	}

	public onCreate(
		context: Context,
		document: IDocument<unknown, unknown>,
		params: Record<string, string>,
	): Promise<void> {
		return this.onCreateHandler?.(context, document, params) ?? Promise.resolve();
	}

	public permission(context: Context, params: Record<string, string>): Promise<DatabaseCollectionPermissions> {
		if (typeof this.permissionHandler === "function") {
			return this.permissionHandler(context, params);
		}
		return Promise.resolve(this.permissionHandler ?? DatabaseCollectionPermissions.None);
	}
}

/**
 * Database document descriptor
 */
export class DatabaseDocumentDescriptor {
	public constructor(
		public readonly reference: string,
		private readonly onUpdateHandler?: DatabaseDocumentChangeHandler<unknown, unknown>,
		private readonly onDeleteHandler?: DatabaseDocumentHandler<unknown, unknown>,
		private readonly permissionHandler?: DatabaseDocumentPermissionHandler,
	) {
		this.matcher = refToRegExp(reference);
	}

	private matcher: RegExp;

	public match(reference: string): undefined | Record<string, string> {
		const match = reference.match(this.matcher);
		if (match) {
			return match.groups ?? {};
		}
	}

	public onUpdate(
		context: Context,
		change: IDocumentChange<unknown, unknown>,
		params: Record<string, string>,
	): Promise<void> {
		return this.onUpdateHandler?.(context, change, params) ?? Promise.resolve();
	}

	public onDelete(
		context: Context,
		document: IDocument<unknown, unknown>,
		params: Record<string, string>,
	): Promise<void> {
		return this.onDeleteHandler?.(context, document, params) ?? Promise.resolve();
	}

	public permission(context: Context, params: Record<string, string>): Promise<DatabaseDocumentPermissions> {
		if (typeof this.permissionHandler === "function") {
			return this.permissionHandler(context, params);
		}
		return Promise.resolve(this.permissionHandler ?? DatabaseDocumentPermissions.None);
	}
}

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
		return new DatabaseDescriptor(
			Array.from(this.collections).map((b) => b.build()),
			Array.from(this.documents).map((b) => b.build()),
		);
	}

	/**
	 * Create a collection builder
	 */
	public collection(reference: string) {
		const builder = new DatabaseCollectionBuilder(reference);
		this.collections.add(builder);
		return builder;
	}

	/**
	 * Create a document builder
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
	private permissionHandler?: DatabaseCollectionPermissionHandler;

	/**
	 * Construct a new Database document builder
	 */
	public constructor(private ref: string) {}

	/**
	 * Build the database collection descriptor
	 */
	public build(): DatabaseCollectionDescriptor {
		return new DatabaseCollectionDescriptor(
			this.ref,
			this.onCreateHandler,
			this.permissionHandler,
		);
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
	public permission(handler: DatabaseCollectionPermissionHandler) {
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
	private permissionHandler?: DatabaseDocumentPermissionHandler;

	/**
	 * Construct a new Database document builder
	 */
	public constructor(private ref: string) {}

	/**
	 * Build the database document descriptor
	 */
	public build(): DatabaseDocumentDescriptor {
		return new DatabaseDocumentDescriptor(
			this.ref,
			this.onUpdateHandler,
			this.onDeleteHandler,
			this.permissionHandler,
		);
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
	public permission(handler: DatabaseDocumentPermissionHandler) {
		this.permissionHandler = handler;
		return this;
	}
}

export const database = new DatabaseBuilder();
