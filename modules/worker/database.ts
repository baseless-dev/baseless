import { IDocument } from "https://baseless.dev/x/provider/database.ts";
import { Context } from "https://baseless.dev/x/provider/context.ts";

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
