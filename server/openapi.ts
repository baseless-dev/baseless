import type { Definition, Method, Routes } from "../common/router/types.ts";
import { isObjectSchema, type Schema } from "../common/schema/types.ts";
import { type BaselessContext, Router, t } from "./baseless.ts";
import type { OpenAPIV3 } from "https://esm.sh/openapi-types@12.1.3";

export default function openapi(
	info: OpenAPIV3.InfoObject,
	servers: OpenAPIV3.ServerObject[] = [],
): (routes: Routes) => Router<[BaselessContext]> {
	return (routes: Routes) => {
		const document: OpenAPIV3.Document = {
			...transformRoutesToOpenAPIV3Document(routes),
			openapi: "3.0.3",
			info,
			servers,
		};
		const json = JSON.stringify(document);

		return new Router<[BaselessContext]>()
			.get("/openapi", (_req, _input, _ctx) => {
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
			})
			.get("/openapi.json", (_req, _input) => {
				return new Response(json, {
					headers: { "content-type": "application/json" },
				});
			});
	};
}

function transformRoutesToOpenAPIV3Document(
	routes: Routes,
): Pick<OpenAPIV3.Document, "components" | "paths"> {
	const components = Object.entries(routes).reduce(
		(components, [_path, operations]) => {
			for (const [_method, { definition }] of Object.entries(operations)) {
				for (
					const key of [
						"params",
						"body",
						"query",
						"response",
					] as (keyof Definition)[]
				) {
					const schema = definition[key] as Schema;
					if (
						schema && isObjectSchema(schema) &&
						"$id" in schema && schema.$id
					) {
						components.schemas ??= {};
						components.schemas[schema.$id] = schema as any;
					}
				}
			}
			return components;
		},
		{} as OpenAPIV3.ComponentsObject,
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
						parameters: [
							...schemaToParameterObject(components, "path", definition.params),
							...schemaToParameterObject(components, "query", definition.query),
						],
						...(definition.body
							? {
								requestBody: schemaToRequestBody(components, definition.body),
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

function schemaToRequestBody(
	components: OpenAPIV3.ComponentsObject,
	schema: Schema,
): OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject {
	const s = schema.$id && schema.$id in components
		? { $ref: `#/components/${schema.$id}` }
		: schema as OpenAPIV3.SchemaObject;
	return {
		required: true,
		content: {
			"application/json": {
				schema: s,
			},
			"application/x-www-form-urlencoded": {
				schema: s,
			},
			"multipart/form-data": {
				schema: s,
			},
		},
	};
}

function schemaToParameterObject(
	components: OpenAPIV3.ComponentsObject,
	location: "path" | "query" | "header" | "cookie",
	schema?: Schema,
): OpenAPIV3.ParameterObject[] {
	if (isObjectSchema(schema)) {
		const objSchema = schema;
		return Object.entries(schema.properties).map(([name, schema]) => {
			const s = schema.$id && schema.$id in components
				? { $ref: `#/components/${schema.$id}` }
				: schema as OpenAPIV3.SchemaObject;
			return {
				in: location,
				name,
				required: objSchema.required?.includes(name) ?? false,
				schema: { description: "Patate", ...s },
			} as OpenAPIV3.ParameterObject;
		});
	}
	return [];
}
