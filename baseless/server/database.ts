import { Logger } from "https://deno.land/std@0.118.0/log/mod.ts";
import { IContext } from "../core/context.ts";
import {
	CollectionReference,
	DatabaseCollectionDescriptor,
	DatabaseDescriptor,
	DatabaseDocumentDescriptor,
	DatabasePermissionHandler,
	DatabasePermissions,
	DatabaseScanFilter,
	DocumentReference,
	IDocument,
} from "../core/database.ts";
import { Result } from "./schema.ts";

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

export default ({
	logger,
	databaseDescriptor,
}: {
	logger: Logger;
	databaseDescriptor: DatabaseDescriptor;
}) => {
	function findCollectionDescriptor<Metadata, Data>(
		ref: string,
	):
		| [DatabaseCollectionDescriptor<Metadata, Data>, Record<string, string>]
		| undefined {
		for (const desc of databaseDescriptor.collections) {
			const match = ref.match(desc.matcher);
			if (match) {
				return [desc, match.groups ?? {}];
			}
		}
		return undefined;
	}

	function findDocumentDescriptor<Metadata, Data>(
		ref: string,
	):
		| [DatabaseDocumentDescriptor<Metadata, Data>, Record<string, string>]
		| undefined {
		for (const desc of databaseDescriptor.documents) {
			const match = ref.match(desc.matcher);
			if (match) {
				return [desc, match.groups ?? {}];
			}
		}
		return undefined;
	}

	async function getPermission(
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

	function testPermission(flag: number, permission: DatabasePermissions) {
		return (flag & permission) > 0;
	}

	return {
		async get(
			_request: Request,
			context: IContext,
			reference: DocumentReference,
		): Promise<Result> {
			const result = findDocumentDescriptor(reference.toString());
			if (result) {
				const [desc, params] = result;
				const permission = await getPermission(
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
		},
		async create<Metadata, Data>(
			_request: Request,
			context: IContext,
			reference: DocumentReference,
			metadata: Metadata,
			data?: Data,
		): Promise<Result> {
			const result = findCollectionDescriptor(reference.collection.toString());
			if (result) {
				const [desc, params] = result;
				const flag = await getPermission(
					context,
					params ?? {},
					desc.permission,
				);
				if (testPermission(flag, DatabasePermissions.Create)) {
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
		},
		async update<Metadata, Data>(
			_request: Request,
			context: IContext,
			reference: DocumentReference,
			metadata: Metadata,
			data?: Data,
		): Promise<Result> {
			const result = findDocumentDescriptor(reference.toString());
			if (result) {
				const [desc, params] = result;
				const flag = await getPermission(
					context,
					params ?? {},
					desc.permission,
				);
				if (testPermission(flag, DatabasePermissions.Update)) {
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
		},
		async list<Metadata>(
			_request: Request,
			context: IContext,
			reference: CollectionReference,
			filter?: DatabaseScanFilter<Metadata>,
		): Promise<Result> {
			const result = findCollectionDescriptor(reference.toString());
			if (result) {
				const [desc, params] = result;
				const flag = await getPermission(context, params, desc.permission);
				if (testPermission(flag, DatabasePermissions.List)) {
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
		},
		async delete(
			_request: Request,
			context: IContext,
			reference: DocumentReference,
		): Promise<Result> {
			const result = findDocumentDescriptor(reference.toString());
			if (result) {
				const [desc, params] = result;
				const flag = await getPermission(context, params, desc.permission);
				if (testPermission(flag, DatabasePermissions.Delete)) {
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
		},
	};
};
