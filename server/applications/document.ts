import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { first } from "@baseless/core/iter";
import { Document, DocumentAtomic, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";
import { CollectionNotFoundError, DocumentAtomicCommitError, DocumentNotFoundError, ForbiddenError } from "@baseless/core/errors";
import { Response } from "@baseless/core/response";

const documentApp = app()
	.endpoint({
		path: "core/document/get",
		request: z.jsonRequest({
			path: z.string(),
			options: z.optional(DocumentGetOptions),
		}),
		response: z.jsonResponse({
			document: Document(),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { path, options } = request.body;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("document", path));
			} catch (cause) {
				throw new DocumentNotFoundError(undefined, { cause });
			}

			if ("documentSecurity" in definition) {
				const permission = await definition.documentSecurity({
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

			const document = await service.document.get(path as never, options);
			return Response.json({ document });
		},
	})
	.endpoint({
		path: "core/document/get-many",
		request: z.jsonRequest({
			paths: z.array(z.string()),
			options: z.optional(DocumentGetOptions),
		}),
		response: z.jsonResponse({
			documents: z.array(Document()),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { paths, options } = request.body;
			for (const key of paths) {
				try {
					// deno-lint-ignore no-var no-inner-declarations
					var [params, definition] = first(app.match("document", key));
				} catch (cause) {
					throw new DocumentNotFoundError(undefined, { cause });
				}

				if ("documentSecurity" in definition) {
					const permission = await definition.documentSecurity({
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
			}

			const documents = await service.document.getMany(paths as never, options);
			return Response.json({ documents });
		},
	})
	.endpoint({
		path: "core/document/commit",
		request: z.jsonRequest({
			atomic: DocumentAtomic,
		}),
		response: z.jsonResponse({
			result: z.boolean(),
		}),
		handler: async ({ app, auth, configuration, context, request, service, signal, waitUntil }) => {
			const { checks, operations } = request.body.atomic;
			const atomic = service.document.atomic();
			for (const check of checks) {
				try {
					const [params, definition] = first(app.match("document", check.key));
					if ("documentSecurity" in definition) {
						const permission = await definition.documentSecurity({
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
					atomic.check(check.key as never, check.versionstamp ?? null);
				} catch (cause) {
					throw new DocumentAtomicCommitError(undefined, { cause });
				}
			}
			for (const op of operations) {
				try {
					const [params, definition] = first(app.match("document", op.key));
					if ("documentSecurity" in definition) {
						const permission = await definition.documentSecurity({
							app,
							auth,
							configuration,
							context,
							params,
							service,
							signal,
							waitUntil,
						});
						if ((op.type === "set" && (permission & Permission.Set) == 0) || (permission & Permission.Delete) == 0) {
							throw new ForbiddenError();
						}
						if (op.type === "set") {
							atomic.set(op.key as never, op.data as never);
						} else {
							atomic.delete(op.key as never);
						}
					}
				} catch (cause) {
					throw new DocumentAtomicCommitError(undefined, { cause });
				}
			}

			await atomic.commit();
			return Response.json({ result: true });
		},
	})
	.endpoint({
		path: "core/document/list",
		request: z.jsonRequest({
			options: DocumentListOptions,
		}),
		response: z.jsonResponse({
			documents: z.array(DocumentListEntry()),
		}),
		handler: async (
			{ app, auth, configuration, context, request, service, signal, waitUntil },
		) => {
			const { prefix, cursor, limit } = request.body.options;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("collection", prefix));
			} catch (cause) {
				throw new CollectionNotFoundError(undefined, { cause });
			}

			if ("collectionSecurity" in definition) {
				const permission = await definition.collectionSecurity({
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

			const stream = await service.document.list({ prefix: prefix as never, cursor, limit });
			const documents = await Array.fromAsync(stream);
			return Response.json({ documents });
		},
	});

export default documentApp;

export type DocumentApplication = ReturnType<typeof documentApp.build>;
