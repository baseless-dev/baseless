// deno-lint-ignore-file no-explicit-any
import {
	type Elysia,
	type InternalRoute,
	type OpenAPIV3,
	t,
	type TSchema,
	TypeGuard,
} from "../../deps.ts";

export type OpenAPIOptions<TPath> = {
	path?: TPath;
	info: OpenAPIV3.InfoObject;
	servers?: OpenAPIV3.ServerObject[];
	tags?: string[];
};

export const openapi = <Path extends string = "/openapi.json">({
	path = "/openapi.json" as Path,
	info,
	servers,
	tags,
}: OpenAPIOptions<Path> = {
	path: "/openapi.json" as Path,
	info: {
		title: "OpenAPI Reference",
		description: "The OpenAPI documentation for this API",
		version: "0.0.0-0",
	},
}) =>
(app: Elysia) => {
	let cachedDocument: string;
	app.get(path, ({ request, query }) => {
		if (request.headers.get("accept")?.includes("text/html")) {
			const swagger = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${info.title}</title>
	<meta name="description" content="${info.description}" />
	<meta name="og:description" content="${info.description}" />
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
			return new Response(query.view === "swagger" ? swagger : scalar, {
				headers: { "content-type": "text/html; charset=utf-8" },
			});
		}
		if (!cachedDocument) {
			const document: OpenAPIV3.Document = {
				...transformRoutesToOpenAPIV3Document(
					app.routes,
					(app as any).definitions?.type,
				),
				openapi: "3.1.0",
				info,
				servers,
			};
			cachedDocument = JSON.stringify(document);
		}
		return new Response(cachedDocument, {
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}, {
		detail: {
			summary: info.title,
			description: info.description,
			tags: tags ?? ["OpenAPI"],
		},
		query: t.Object({
			view: t.Union([
				t.Literal("swagger"),
				t.Literal("scalar"),
			], { default: "scalar" }),
		}),
	});
	return app;
};

export default openapi;

function transformRoutesToOpenAPIV3Document(
	routes: InternalRoute[],
	models?: Record<string, TSchema>,
): Pick<OpenAPIV3.Document, "components" | "paths"> {
	const components: OpenAPIV3.ComponentsObject = {
		schemas: {
			...models,
		},
	};
	routes = routes.map((route: any) => {
		return {
			...route,
			hooks: {
				...route.hooks,
				params: route.hooks.params
					? promoteSchemaComponents(components, route.hooks.params)
					: undefined,
				headers: route.hooks.headers
					? promoteSchemaComponents(components, route.hooks.headers)
					: undefined,
				query: route.hooks.query
					? promoteSchemaComponents(components, route.hooks.query)
					: undefined,
				body: route.hooks.body
					? promoteSchemaComponents(components, route.hooks.body)
					: undefined,
				cookie: route.hooks.cookie
					? promoteSchemaComponents(components, route.hooks.cookie)
					: undefined,
				response: route.hooks.response
					? promoteResponseComponents(components, route.hooks.response)
					: undefined,
			},
		};
	});
	const paths = routes.reduce((paths, route) => {
		const path = transformPath(route.path);
		const hooks = route.hooks as any;
		return {
			...paths,
			[path]: {
				...paths[path],
				[route.method.toLowerCase()]: {
					...hooks.detail,
					parameters: [
						...schemaToParameterObject("path", hooks.params),
						...schemaToParameterObject("query", hooks.query),
						...schemaToParameterObject("header", hooks.headers),
						...schemaToParameterObject("cookie", hooks.cookie),
					],
					...(hooks.body
						? {
							requestBody: schemaToRequestBody(hooks.body),
						}
						: {}),
					responses: hooks.response,
				},
			},
		};
	}, {} as OpenAPIV3.PathsObject);
	return {
		paths,
		components,
	};
}

function transformPath(path: string): string {
	return path
		.split("/")
		.map((x) => (x.startsWith(":") ? `{${x.slice(1)}}` : x))
		.join("/");
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
	schema?: TSchema,
): OpenAPIV3.ParameterObject[] {
	if (TypeGuard.IsObject(schema)) {
		return Object.entries(schema.properties).map(([name, schema]) => {
			return {
				name,
				in: location,
				schema,
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

function promoteResponseComponents(
	components: OpenAPIV3.ComponentsObject,
	response: unknown,
): unknown {
	if (response && typeof response === "object") {
		if (TypeGuard.IsSchema(response)) {
			// Schema
			return {
				200: {
					description: "",
					content: {
						"application/json": {
							schema: promoteSchemaComponents(components, response as TSchema),
						},
					},
				},
			};
		} else {
			// Statuses
			return Object.fromEntries(
				Object.entries(response).map(([status, schema]) => {
					return [status, {
						description: "",
						content: {
							"application/json": {
								schema: promoteSchemaComponents(components, schema),
							},
						},
					}];
				}),
			);
		}
	} else if (
		response && typeof response === "string" && components.schemas &&
		response in components.schemas
	) {
		// Model name
		return {
			200: {
				description: "",
				content: {
					"application/json": {
						schema: t.Ref(`#/components/schemas/${response}`),
					},
				},
			},
		};
	}
	throw new Error("Invalid response type.");
}

function* walk(
	schema: TSchema,
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
		};
	} else if (TypeGuard.IsObject(schema)) {
		const properties: typeof schema.properties = {};
		for (const [key, propSchema] of Object.entries(schema.properties)) {
			properties[key] = yield* walk(propSchema as any);
		}
		return {
			...schema,
			properties,
		};
	} else if (TypeGuard.IsUnion(schema)) {
		const anyOf = [];
		for (const unionSchema of schema.anyOf) {
			anyOf.push(yield* walk(unionSchema));
		}
		return {
			...schema,
			anyOf,
		};
	}
	return schema;
}
