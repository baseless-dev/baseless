import {
	CollectionReference,
	DatabaseCollectionDescriptor,
	DatabaseDocumentDescriptor,
	DatabasePermissionHandler,
	DatabasePermissions,
	DatabaseScanFilter,
	DocumentReference,
	IDocument,
} from "../core/database.ts";
import { IContext } from "../core/context.ts";
import { Result } from "./schema.ts";
import { ServerData } from "../server.ts";

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
	public constructor(
		private data: ServerData,
	) {}

	private _findCollectionDescriptor<Metadata, Data>(
		ref: string,
	):
		| [DatabaseCollectionDescriptor<Metadata, Data>, Record<string, string>]
		| undefined {
		const collections = this.data.databaseDescriptor.collections;
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
		const documents = this.data.databaseDescriptor.documents;
		for (const desc of documents) {
			const match = ref.match(desc.matcher);
			if (match) {
				return [desc, match.groups ?? {}];
			}
		}
		return undefined;
	}

	private async _getPermission(
		context: IContext,
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
		context: IContext,
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
		context: IContext,
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
		context: IContext,
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
		context: IContext,
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
		context: IContext,
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
