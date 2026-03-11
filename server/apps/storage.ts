import { app, INTERNAL_HIDE_ENDPOINT, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { first } from "@baseless/core/iter";
import {
	StorageListEntry,
	StorageListOptions,
	StorageObject,
	StorageSignedDownloadUrlOptions,
	StorageSignedUploadUrlOptions,
	StorageSignedUrl,
} from "@baseless/core/storage";
import { ForbiddenError, StorageFolderNotFoundError, StorageObjectNotFoundError } from "@baseless/core/errors";
import { Response } from "@baseless/core/response";

const storageApp = app()
	.endpoint({
		path: "storage/get-metadata",
		request: z.jsonRequest({
			path: z.string(),
		}),
		response: z.jsonResponse({
			object: StorageObject(),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { path } = request.body;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("file", path));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}

			if ("fileSecurity" in definition) {
				const permission = await definition.fileSecurity({
					app,
					auth,
					configuration,
					context,
					params,
					service,
					signal,
					waitUntil,
				});
				if ((permission & Permission.Get) == 0) {
					throw new ForbiddenError();
				}
			}

			const object = await service.storage.getMetadata(path as never, {} as never, { signal });
			return Response.json({ object });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("storage/get-metadata")
	.endpoint({
		path: "storage/upload-url",
		request: z.jsonRequest({
			path: z.string(),
			options: z.optional(StorageSignedUploadUrlOptions),
		}),
		response: z.jsonResponse({
			url: StorageSignedUrl(),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { path, options } = request.body;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("file", path));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}

			if ("fileSecurity" in definition) {
				const permission = await definition.fileSecurity({
					app,
					auth,
					configuration,
					context,
					params,
					service,
					signal,
					waitUntil,
				});
				if ((permission & Permission.Set) == 0) {
					throw new ForbiddenError();
				}
			}

			// Merge server-defined conditions into upload options (definition wins)
			const mergedOptions = "conditions" in definition && definition.conditions
				? { ...options, conditions: { ...options?.conditions, ...definition.conditions } }
				: options;

			const url = await service.storage.getSignedUploadUrl(path as never, {} as never, { ...mergedOptions, signal });
			return Response.json({ url });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("storage/upload-url")
	.endpoint({
		path: "storage/download-url",
		request: z.jsonRequest({
			path: z.string(),
			options: z.optional(StorageSignedDownloadUrlOptions),
		}),
		response: z.jsonResponse({
			url: StorageSignedUrl(),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { path, options } = request.body;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("file", path));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}

			if ("fileSecurity" in definition) {
				const permission = await definition.fileSecurity({
					app,
					auth,
					configuration,
					context,
					params,
					service,
					signal,
					waitUntil,
				});
				if ((permission & Permission.Get) == 0) {
					throw new ForbiddenError();
				}
			}

			const url = await service.storage.getSignedDownloadUrl(path as never, {} as never, { ...options, signal });
			return Response.json({ url });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("storage/download-url")
	.endpoint({
		path: "storage/delete",
		request: z.jsonRequest({
			path: z.string(),
		}),
		response: z.jsonResponse({
			result: z.boolean(),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { path } = request.body;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("file", path));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}

			if ("fileSecurity" in definition) {
				const permission = await definition.fileSecurity({
					app,
					auth,
					configuration,
					context,
					params,
					service,
					signal,
					waitUntil,
				});
				if ((permission & Permission.Delete) == 0) {
					throw new ForbiddenError();
				}
			}

			await service.storage.delete(path as never, {} as never, { signal });
			return Response.json({ result: true });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("storage/delete")
	.endpoint({
		path: "storage/list",
		request: z.jsonRequest({
			options: StorageListOptions,
		}),
		response: z.jsonResponse({
			entries: z.array(StorageListEntry()),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { prefix, cursor, limit } = request.body.options;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("folder", prefix));
			} catch (cause) {
				throw new StorageFolderNotFoundError(undefined, { cause });
			}

			if ("folderSecurity" in definition) {
				const permission = await definition.folderSecurity({
					app,
					auth,
					configuration,
					context,
					params,
					service,
					signal,
					waitUntil,
				});
				if ((permission & Permission.List) == 0) {
					throw new ForbiddenError();
				}
			}

			const stream = service.storage.list(prefix as never, {} as never, { cursor, limit, signal });
			const entries = await Array.fromAsync(stream);
			return Response.json({ entries });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("storage/list");

export default storageApp;

/** The compiled storage {@link App} returned by `storageApp.build()`. */
export type StorageApplication = ReturnType<typeof storageApp.build>;
