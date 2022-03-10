import { IDocument } from "https://baseless.dev/x/provider/database.ts";
import { Context } from "https://baseless.dev/x/provider/context.ts";
import { logger } from "https://baseless.dev/x/logger/mod.ts";
import {
	CollectionNotFoundError,
	CollectionReference,
	CreateDocumentError,
	DatabaseScanFilter,
	DeleteDocumentError,
	DocumentNotFoundError,
	DocumentReference,
	UpdateDocumentError,
} from "https://baseless.dev/x/shared/database.ts";
import { Result } from "./schema.ts";
import {
	DatabaseCollectionDescriptor,
	DatabaseDescriptor,
	DatabaseDocumentDescriptor,
	DatabasePermissionHandler,
	DatabasePermissions,
} from "https://baseless.dev/x/worker/database.ts";
import { UnknownError } from "https://baseless.dev/x/shared/server.ts";

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

	public async get(
		context: Context,
		reference: DocumentReference,
	): Promise<Result> {
		const [desc, params] = this.databaseDescriptor.getDocumentDescriptor(reference.toString()) ?? [];
		if (desc && params) {
			const permission = await desc.permission(context, params);
			if ((permission & DatabasePermissions.Get) > 0) {
				try {
					const doc = await context.database.get(reference);
					return { metadata: doc.metadata, data: await doc.data() };
				} catch (err) {
					this.logger.error(`Could not get document "${reference}", got ${err}`);
					throw new DocumentNotFoundError();
				}
			}
		}
		throw new DocumentNotFoundError();
	}

	public async create<Metadata, Data>(
		context: Context,
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
	): Promise<Result> {
		const [desc, params] = this.databaseDescriptor.getCollectionDescriptor(reference.collection.toString()) ?? [];
		if (desc && params) {
			const flag = await desc.permission(context, params);
			if ((flag & DatabasePermissions.Create) > 0) {
				try {
					await context.database.create(reference, metadata, data);
					const doc = new Document(reference, metadata, data ?? {});
					await desc.onCreate(context, doc, params);
					return {};
				} catch (err) {
					this.logger.error(`Could not create document "${reference}", got ${err}`);
					throw new CreateDocumentError();
				}
			}
		}
		throw new CollectionNotFoundError();
	}

	public async update<Metadata, Data>(
		context: Context,
		reference: DocumentReference,
		metadata: Metadata,
		data?: Data,
		replace?: boolean,
	): Promise<Result> {
		const [desc, params] = this.databaseDescriptor.getDocumentDescriptor(reference.toString()) ?? [];
		if (desc && params) {
			const flag = await desc.permission(context, params);
			if ((flag & DatabasePermissions.Update) > 0) {
				try {
					const before = await context.database.get(reference);
					let after: IDocument<Metadata, Data>;
					if (replace === true) {
						await context.database.replace(reference, metadata, data);
						after = new Document(reference, metadata, data ?? {});
					} else {
						await context.database.update(reference, metadata, data);
						after = new Document(reference, { ...before.metadata, ...metadata }, { ...before.data, ...data });
					}
					await desc.onUpdate(context, { before, after }, params);
					return {};
				} catch (err) {
					this.logger.error(`Could not update document "${reference}", got ${err}`);
					throw new UpdateDocumentError();
				}
			}
		}
		throw new DocumentNotFoundError();
	}

	public async list<Metadata>(
		context: Context,
		reference: CollectionReference,
		filter?: DatabaseScanFilter<Metadata>,
	): Promise<Result> {
		const [desc, params] = this.databaseDescriptor.getCollectionDescriptor(reference.toString()) ?? [];
		if (desc && params) {
			const flag = await desc.permission(context, params);
			if ((flag & DatabasePermissions.List) > 0) {
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
					this.logger.error(`Could not list collection "${reference}", got ${err}`);
					throw new UnknownError();
				}
			}
		}
		throw new CollectionNotFoundError();
	}

	public async delete(
		context: Context,
		reference: DocumentReference,
	): Promise<Result> {
		const [desc, params] = this.databaseDescriptor.getDocumentDescriptor(reference.toString()) ?? [];
		if (desc && params) {
			const flag = await desc.permission(context, params);
			if ((flag & DatabasePermissions.Delete) > 0) {
				try {
					const doc = await context.database.get(reference);
					await context.database.delete(reference);
					await desc.onDelete(context, doc, params);
					return {};
				} catch (err) {
					if (err instanceof DocumentNotFoundError) {
						return {};
					}
					this.logger.error(`Could not delete document "${reference}", got ${err}`);
					throw new DeleteDocumentError();
				}
			}
		}
		throw new DocumentNotFoundError();
	}
}
