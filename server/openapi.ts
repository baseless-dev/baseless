import type { Routes } from "../common/router/types.ts";
import { walk } from "../common/schema/schema.ts";
import { isObjectSchema, type Schema } from "../common/schema/types.ts";
import { type BaselessContext, Router, t } from "./baseless.ts";
import type { OpenAPIV3 } from "https://esm.sh/openapi-types@12.1.3";

// deno-lint-ignore explicit-function-return-type
export default function openapi(
	info: OpenAPIV3.InfoObject,
	meta?: {
		tags?: string[];
		summary?: string;
		description?: string;
	},
	servers: OpenAPIV3.ServerObject[] = [],
) {
	return async (routes: Routes) => {
		const app = new Router<[BaselessContext]>()
			.get("/openapi.json", (req, _input, _ctx) => {
				if (req.headers.get("accept")?.includes("text/html")) {
					const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${info.title}</title>
	<meta name="description" content="${info.description}" />
	<meta name="og:description" content="${info.description}" />
	<style>body { margin: 0 }</style>
</head>
<body>
	<script id="api-reference" data-url="/openapi.json"></script>
	<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
					return new Response(html, {
						headers: { "content-type": "text/html; charset=utf-8" },
					});
				}
				return new Response(json, {
					headers: { "content-type": "application/json" },
				});
			}, {
				summary: meta?.summary ?? `OpenAPI Documentation`,
				description: meta?.description ??
					`The OpenAPI documentation for this API`,
				tags: meta?.tags ?? ["OpenAPI"],
				headers: t.Object({
					Accept: t.Default(
						"application/json",
						t.Example(
							"text/html",
							t.Describe(
								"The content type of the response",
								t.String(),
							),
						),
					),
				}),
				response: {
					200: {
						description: "The OpenAPI documentation for this API",
						content: {
							"text/html": {
								schema: t.Example(
									`<!DOCTYPE html>\n<html lang="en">\n\t...\n</html>`,
									t.String(),
								),
							},
							"application/json": {
								schema: t.Example(
									`{\n\t"openapi":"3.1.0",\n\t...\n}`,
									t.String(),
								),
							},
						},
					},
				},
			});

		routes = { ...routes, ...await app.getRoutes() };

		const document: OpenAPIV3.Document = {
			...transformRoutesToOpenAPIV3Document(routes),
			openapi: "3.1.0",
			info,
			servers,
		};
		const json = JSON.stringify(document);

		return app;
	};
}

function transformRoutesToOpenAPIV3Document(
	routes: Routes,
): Pick<OpenAPIV3.Document, "components" | "paths"> {
	const components: OpenAPIV3.ComponentsObject = {};
	routes = Object.fromEntries(
		Object.entries(routes).map(([path, operations]) => [
			path,
			Object.fromEntries(
				Object.entries(operations).map(([method, operation]) => [
					method,
					{
						...operation,
						definition: {
							...operation.definition,
							params: operation.definition.params &&
								promoteSchemaComponents(
									components,
									operation.definition.params,
								) as any,
							headers: operation.definition.headers &&
								promoteSchemaComponents(
									components,
									operation.definition.headers,
								) as any,
							body: operation.definition.body &&
								promoteSchemaComponents(
									components,
									operation.definition.body,
								) as any,
							query: operation.definition.query &&
								promoteSchemaComponents(
									components,
									operation.definition.query,
								) as any,
							response: operation.definition.response && Object.fromEntries(
								Object.entries(operation.definition.response).map((
									[status, response],
								) => [
									status,
									{
										...response,
										content: response.content && Object.fromEntries(
											Object.entries(response.content).map((
												[contentType, content],
											) => [
												contentType,
												{
													...content,
													schema: promoteSchemaComponents(
														components,
														content.schema,
													) as any,
												},
											]),
										),
									},
								]),
							),
						},
					},
				]),
			),
		]),
	);
	const paths = Object.entries(routes).reduce((paths, [path, operations]) => {
		path = path.replace(/\{\.\.\.(\w+)\}/g, "{$1}");
		for (const [method, { definition }] of Object.entries(operations)) {
			paths = {
				...paths,
				[path]: {
					...paths[path],
					[method.toLowerCase()]: {
						summary: definition.summary,
						description: definition.description,
						tags: definition.tags,
						parameters: [
							...schemaToParameterObject("path", definition.params),
							...schemaToParameterObject("query", definition.query),
							...schemaToParameterObject("header", definition.headers),
						],
						...(definition.body
							? {
								requestBody: schemaToRequestBody(definition.body),
							}
							: {}),
						responses: {
							"500": {
								description: "Unexpected server error",
							},
							...definition.response,
						},
					} satisfies OpenAPIV3.OperationObject,
				},
			};
		}
		return paths;
	}, {} as OpenAPIV3.PathsObject);
	return {
		paths,
		components,
	};
}

function promoteSchemaComponents(
	components: OpenAPIV3.ComponentsObject,
	schema: Schema,
): Schema {
	const iter = walk(schema);
	let result = iter.next();
	for (
		let replacement = undefined;
		!result.done;
		result = iter.next(replacement), replacement = undefined
	) {
		const { $id, ...rest } = result.value;
		if ($id) {
			components.schemas ??= {};
			components.schemas![$id] = promoteSchemaComponents(
				components,
				rest,
			) as any;
			replacement = t.Ref(`#/components/schemas/${$id}`);
		}
	}
	return result.value;
}

function schemaToRequestBody(
	schema: Schema,
): OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject {
	return {
		required: true,
		content: {
			"application/json": {
				schema: schema as any,
			},
			"application/x-www-form-urlencoded": {
				schema: schema as any,
			},
			"multipart/form-data": {
				schema: schema as any,
			},
		},
	};
}

function schemaToParameterObject(
	location: "path" | "query" | "header" | "cookie",
	schema?: Schema,
): OpenAPIV3.ParameterObject[] {
	if (isObjectSchema(schema)) {
		const objSchema = schema;
		return Object.entries(schema.properties).map(([name, schema]) => {
			return {
				in: location,
				name,
				required: objSchema.required?.includes(name) ?? false,
				schema,
			} as OpenAPIV3.ParameterObject;
		});
	}
	return [];
}
