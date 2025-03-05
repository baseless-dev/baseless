// deno-lint-ignore-file no-explicit-any
import { onRequest, Permission, type TCollection, type TDefinition, type TDocument, topic } from "../app.ts";
import { Document, DocumentAtomic, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";
import * as Type from "@baseless/core/schema";
import type { Matcher } from "@baseless/core/path";
import { first } from "@baseless/core/iter";

export default function createDocumentApplication(
	documentMatcher: Matcher<TDocument<any, any>>,
	collectionMatcher: Matcher<TCollection<any, any, any>>,
): TDefinition[] {
	return [
		topic(
			"document/set",
			Type.Object({ key: Type.String(), data: Type.Unknown() }, ["key", "data"]),
		),
		topic(
			"document/deleted",
			Type.Object({ key: Type.String() }, ["key"]),
		),
		onRequest(
			"document/get",
			Type.Object({
				path: Type.Index(Document, "key"),
				options: DocumentGetOptions,
			}, ["path"]),
			Document,
			async ({ auth, context, service, signal, input, waitUntil }) => {
				try {
					// deno-lint-ignore no-var no-inner-declarations
					var [params, definition] = first(documentMatcher(input.path));
				} catch (_error) {
					throw "NOT_FOUND";
				}

				if (definition.security) {
					const permission = await definition.security({
						auth,
						context,
						params,
						service,
						signal,
						waitUntil,
					});
					if ((permission & Permission.Get) == 0) {
						throw "FORBIDDEN";
					}
				}

				const document = await service.document.get(input.path, input.options);
				return document;
			},
			() => Permission.All,
		),
		onRequest(
			"document/get-many",
			Type.Object({
				paths: Type.Array(Type.Index(Document, "key")),
				options: DocumentGetOptions,
			}, ["paths"]),
			Type.Array(Document),
			async ({ auth, context, service, signal, input, waitUntil }) => {
				for (const key of input.paths) {
					try {
						// deno-lint-ignore no-var no-inner-declarations
						var [params, definition] = first(documentMatcher(key));
					} catch (_error) {
						throw "NOT_FOUND";
					}

					if (definition.security) {
						const permission = await definition.security({
							auth,
							context,
							params,
							service,
							signal,
							waitUntil,
						});
						if ((permission & Permission.Get) == 0) {
							throw "FORBIDDEN";
						}
					}
				}

				const documents = await service.document.getMany(input.paths, input.options);
				return documents;
			},
			() => Permission.All,
		),
		onRequest(
			"document/commit",
			DocumentAtomic,
			Type.Void(),
			async ({ auth, context, service, signal, input: { checks, operations }, waitUntil }) => {
				const atomic = service.document.atomic();
				for (const check of checks) {
					try {
						const [params, definition] = first(documentMatcher(check.key));
						if (definition.security) {
							const permission = await definition.security({
								auth,
								context,
								params,
								service,
								signal,
								waitUntil,
							});
							if ((permission & Permission.Get) == 0) {
								throw "FORBIDDEN";
							}
						}
					} catch (_error) {
						throw "NOT_FOUND";
					}
					atomic.check(check.key, check.versionstamp ?? null);
				}
				for (const op of operations) {
					try {
						const [params, definition] = first(documentMatcher(op.key));
						if (definition.security) {
							const permission = await definition.security({
								auth,
								context,
								params,
								service,
								signal,
								waitUntil,
							});
							if ((op.type === "set" && (permission & Permission.Set) == 0) || (permission & Permission.Delete) == 0) {
								throw "FORBIDDEN";
							}
						}
					} catch (_error) {
						throw "NOT_FOUND";
					}
					if (op.type === "set") {
						atomic.set(op.key, op.data);
					} else {
						atomic.delete(op.key);
					}
				}

				return atomic.commit();
			},
			() => Permission.All,
		),
		onRequest(
			"document/list",
			DocumentListOptions,
			Type.Array(DocumentListEntry),
			async ({ auth, context, service, signal, input: { prefix, cursor, limit }, waitUntil }) => {
				try {
					// deno-lint-ignore no-var no-inner-declarations
					var [params, definition] = first(collectionMatcher(prefix));
				} catch (_error) {
					throw "NOT_FOUND";
				}

				if (definition.security) {
					const permission = await definition.security({
						auth,
						context,
						params,
						service,
						signal,
						waitUntil,
					});
					if ((permission & Permission.List) == 0) {
						throw "FORBIDDEN";
					}
				}

				const documents = await service.document.list({ prefix, cursor, limit });
				return Array.fromAsync(documents);
			},
			() => Permission.All,
		),
	];
}
