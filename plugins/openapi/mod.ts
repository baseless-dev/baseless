// deno-lint-ignore-file no-explicit-any
import { t, type TSchema } from "../../lib/typebox.ts";
import { TypeGuard } from "npm:@sinclair/typebox@0.32.13/type";
import type { OpenAPIV3 } from "npm:openapi-types@12.1.3";
import { Router } from "../../lib/router/router.ts";
import type { Definition, Route, Routes } from "../../lib/router/types.ts";
import { OpenAPIConfiguration } from "./configuration.ts";

export const openapi = (
	builder?:
		| OpenAPIConfiguration
		| ((configuration: OpenAPIConfiguration) => OpenAPIConfiguration),
) =>
(routes: ReadonlyArray<Route>) => {
	const configuration = builder instanceof OpenAPIConfiguration
		? builder.build()
		: builder
		? builder(new OpenAPIConfiguration()).build()
		: new OpenAPIConfiguration().build();
	let cachedDocument: string;
	return new Router()
		.get(configuration.path, ({ request, query }) => {
			if (request.headers.get("accept")?.includes("text/html")) {
				const swagger = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${configuration.info.title}</title>
	<meta name="description" content="${configuration.info.description}" />
	<meta name="og:description" content="${configuration.info.description}" />
	<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
    <script>window.onload = () => { window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: '#swagger-ui' }); };</script>
</body>
</html>`;
				const scalar = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${configuration.info.title}</title>
	<meta name="description" content="${configuration.info.description}" />
	<meta name="og:description" content="${configuration.info.description}" />
	<style>body { margin: 0 }</style>
</head>
<body>
	<script id="api-reference" data-url="/openapi.json"></script>
	<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
				return new Response(query.view === "swagger" ? swagger : scalar, {
					headers: { "content-type": "text/html; charset=utf-8" },
				});
			}
			if (!cachedDocument) {
				const document: OpenAPIV3.Document = {
					...transformRoutesToOpenAPIV3Document(
						[...routes],
					),
					openapi: "3.1.0",
					info: configuration.info,
					servers: configuration.servers,
				};
				cachedDocument = JSON.stringify(document);
			}
			return new Response(cachedDocument, {
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		}, {
			detail: {
				summary: configuration.info.title,
				description: configuration.info.description,
				tags: configuration.tags ?? ["OpenAPI"],
			},
			query: t.Object({
				view: t.Optional(
					t.Union([
						t.Literal("swagger"),
						t.Literal("scalar"),
					], { default: "scalar" }),
				),
			}),
		});
};

export default openapi;

function transformRoutesToOpenAPIV3Document(
	routes: Routes,
): Pick<OpenAPIV3.Document, "components" | "paths"> {
	const components: OpenAPIV3.ComponentsObject = {
		schemas: {},
	};
	routes = routes.map((route) => {
		return {
			...route,
			definition: {
				...route.definition,
				params: route.definition.params
					? promoteSchemaComponents(components, route.definition.params)
					: undefined,
				headers: route.definition.headers
					? promoteSchemaComponents(components, route.definition.headers)
					: undefined,
				query: route.definition.query
					? promoteSchemaComponents(components, route.definition.query)
					: undefined,
				body: route.definition.body
					? promoteSchemaComponents(components, route.definition.body)
					: undefined,
				response: route.definition.response
					? promoteResponseComponents(components, route.definition.response)
					: undefined,
			},
		} as Route;
	});
	routes.sort((a, b) => a.path.localeCompare(b.path));

	const paths = routes.reduce((paths, route) => {
		const path = route.path.replace(/\{\.\.\.(\w+)\}/g, "{$1}");
		return {
			...paths,
			[path]: {
				...paths[path],
				[route.method.toLowerCase()]: {
					...route.definition.detail,
					parameters: [
						...schemaToParameterObject("path", route.definition.params),
						...schemaToParameterObject("query", route.definition.query),
						...schemaToParameterObject("header", route.definition.headers),
					],
					...(route.definition.body
						? {
							requestBody: schemaToRequestBody(route.definition.body),
						}
						: {}),
					responses: route.definition.response,
				},
			},
		};
	}, {} as OpenAPIV3.PathsObject);
	return {
		paths,
		components,
	};
}

function schemaToRequestBody(
	schema: TSchema,
): OpenAPIV3.ReferenceObject | OpenAPIV3.RequestBodyObject {
	return {
		required: true,
		content: {
			"application/json": {
				schema,
			},
			"application/x-www-form-urlencoded": {
				schema,
			},
			"multipart/form-data": {
				schema,
			},
		},
	};
}

function schemaToParameterObject(
	location: string,
	schema?: any,
): OpenAPIV3.ParameterObject[] {
	if (TypeGuard.IsObject(schema)) {
		return Object.entries(schema.properties).map(([name, schema]) => {
			return {
				name,
				in: location,
				schema: location === "path" && TypeGuard.IsArray(schema) &&
						TypeGuard.IsString(schema.items)
					? t.String({ format: "path" })
					: schema,
				required: location === "path" ? true : (schema as any).required,
			} as OpenAPIV3.ParameterObject;
		});
	}
	return [];
}

function promoteSchemaComponents(
	components: OpenAPIV3.ComponentsObject,
	schema: TSchema,
): TSchema {
	const iter = walk(schema);
	let result = iter.next();
	for (
		let replacement: undefined | TSchema = undefined;
		!result.done;
		result = iter.next(replacement), replacement = undefined
	) {
		const { $id, $ref, ...rest } = result.value;
		if ($id) {
			components.schemas ??= {};
			components.schemas![$id] = promoteSchemaComponents(
				components,
				rest,
			) as any;
			replacement = t.Ref(`#/components/schemas/${$id}`);
		} else if ($ref && !$ref.startsWith("#")) {
			replacement = t.Ref(`#/components/schemas/${$ref}`);
		}
	}
	return result.value;
}

type MapKeyToString<T> = {
	[K in keyof T as `${string & K}`]: T[K];
};

function promoteResponseComponents(
	components: OpenAPIV3.ComponentsObject,
	response: NonNullable<Definition<any, any, any, any>["response"]>,
): Definition<any, any, any, any>["response"] {
	return Object.fromEntries(
		Object.entries(response)
			.map(([status, meta]) => [status, {
				...meta,
				content: Object.fromEntries(
					Object.entries(meta.content ?? {})
						.map(([contentType, content]) => [
							contentType,
							{
								...content,
								schema: promoteSchemaComponents(components, content.schema),
							},
						]),
				),
			}]),
	);
}

function* walk(
	schema: any,
): Generator<TSchema, TSchema, TSchema | false | undefined> {
	const op = yield schema;
	if (op === false) {
		return schema;
	} else if (op !== undefined) {
		return yield* walk(op);
	}
	if (TypeGuard.IsArray(schema)) {
		return {
			...schema,
			items: yield* walk((schema as any).items),
		} as any;
	} else if (TypeGuard.IsObject(schema)) {
		const properties: Record<string, TSchema> = {};
		for (const [key, propSchema] of Object.entries(schema.properties)) {
			properties[key] = yield* walk(propSchema as any);
		}
		return {
			...schema,
			properties,
		} as any;
	} else if (TypeGuard.IsUnion(schema)) {
		const anyOf = [];
		for (const unionSchema of schema.anyOf) {
			anyOf.push(yield* walk(unionSchema));
		}
		return {
			...schema,
			anyOf,
		} as any;
	}
	return schema;
}
