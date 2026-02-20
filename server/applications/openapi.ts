import { App, app, AppRegistry, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import type { OpenAPIV3 } from "openapi-types";
import { Response } from "@baseless/core/response";

const cache = new WeakMap<App<AppRegistry>, OpenAPIV3.Document>();

export default app()
	.requireConfiguration({
		openapi: {
			info: {
				title: "OpenAPI Reference",
				description: "The OpenAPI documentation for this API",
				version: "0.0.0-0",
			},
		} as {
			info: OpenAPIV3.InfoObject;
			path?: string;
			servers?: OpenAPIV3.ServerObject[];
			tags?: OpenAPIV3.TagObject[];
		},
	})
	.endpoint({
		path: "openapi.json",
		request: z.request({
			summary: "Get OpenAPI schema",
			searchParams: {
				ui: z.optional(z.union([
					z.literal("scalar"),
					z.literal("swagger"),
				])),
			},
			headers: {
				"Accept": z.optional(z.string()),
			},
		}),
		response: z.union([
			z.response({
				description: "OpenAPI Browser",
				status: 200,
				headers: { "content-type": z.literal("text/html") },
				body: z.string(),
			}),
			z.jsonResponse(),
		]),
		handler: async ({ app, configuration, request }) => {
			const accept = request.headers.get("Accept");
			if (accept?.includes("text/html")) {
				const options = {
					title: configuration.openapi.info.title,
					description: configuration.openapi.info.description || "",
				};
				const body = request.url.searchParams.get("ui") === "swagger" ? swagger(options) : scalar(options);
				return new Response(body, {
					status: 200,
					headers: { "content-type": "text/html" },
				});
			}
			let document = cache.get(app);
			if (!document) {
				document = {
					...configuration.openapi,
					...endpointsDefinitionToOpenAPI(app.endpoints),
					openapi: "3.1.0",
				};
				cache.set(app, document);
			}
			return Response.json(document);
		},
	});

function endpointsDefinitionToOpenAPI(endpoints: App<AppRegistry>["endpoints"]): Pick<OpenAPIV3.Document, "components" | "paths"> {
	const components: OpenAPIV3.ComponentsObject = {};
	const paths: OpenAPIV3.PathsObject = {};

	// https://github.com/baseless-dev/baseless/blob/v0.2/plugins/openapi/mod.ts

	for (const [path, methods] of Object.entries(endpoints)) {
		const convertedPath = convertPath(path);
		paths[convertedPath] ??= {};
		for (const [method, endpoint] of Object.entries(methods)) {
			const requestSchema = endpoint.request;
			const responseSchemas = endpoint.response.type === "union" ? endpoint.response.def.options : [endpoint.response];
			const searchParams = isAnyZodType(requestSchema.def.params?.searchParams)
				? z.toJSONSchema(requestSchema.def.params!.searchParams!)
				: undefined;
			const responses = responseToOpenAPIResponse(responseSchemas, components);
			const parameters: OpenAPIV3.ParameterObject[] = [];
			const body = isAnyZodType(requestSchema.def.params?.body) ? z.toJSONSchema(requestSchema.def.params!.body!) : undefined;
			for (const param of path.split("/").filter((p) => p.startsWith(":"))) {
				parameters.push({
					in: "path",
					name: param.substring(1),
					schema: { type: "string" },
					required: true,
				});
			}
			for (const [name, schema] of Object.entries(searchParams?.properties ?? {})) {
				parameters.push({
					in: "query",
					name,
					schema: schema as OpenAPIV3.SchemaObject,
					required: searchParams?.required?.includes(name) ?? false,
				});
			}

			paths[convertedPath]![method.toLowerCase() as OpenAPIV3.HttpMethods] = {
				summary: requestSchema.def.params?.summary,
				description: requestSchema.def.params?.description,
				...(parameters.length > 0 ? { parameters } : {}),
				// ...(requestBody ? { requestBody } : {}),
				responses,
			};
		}
	}

	return { components, paths };
}

function convertPath(path: string): string {
	const parts = path.split("/").map((p) => p.startsWith(":") ? `{${p.substring(1)}}` : p);
	return parts.join("/");
}

function responseToOpenAPIResponse(responseSchemas: z.ZodResponse[], components: OpenAPIV3.ComponentsObject): OpenAPIV3.ResponsesObject {
	const responses: { [code: string]: OpenAPIV3.ResponseObject } = {};
	for (const responseSchema of responseSchemas) {
		const status = responseSchema.def.params?.status ?? 200;
		const description = responseSchema.def.params?.description;
		const contentType = responseSchema.def.params?.headers
			? (responseSchema.def.params.headers.def.shape["content-type"] as z.ZodLiteral<string> | undefined)?.def.values[0]!
			: "application/json";

		const schema = z.toJSONSchema(
			isAnyZodType(responseSchema.def.params?.body) ? responseSchema.def.params!.body! : z.looseObject({}),
		);
		const headers = isAnyZodType(responseSchema.def.params?.headers) ? z.toJSONSchema(responseSchema.def.params!.headers!) : undefined;

		responses[status] = {
			...(responses[status] ?? {}),
			...(description ? { description } : {}),
			content: {
				...(responses[status]?.content ?? {}),
				[contentType]: {
					schema: schema as OpenAPIV3.SchemaObject,
					...(headers ? { headers: headers.properties } : {}),
				},
			},
		};
	}
	return responses;
}

export const isAnyZodType = (schema: unknown): schema is z.core.$ZodTypes =>
	typeof schema === "object" && schema !== null && "_zod" in schema;

const scalar = (options: { title: string; description: string }) =>
	`<!doctype html>
	<html>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${options.title}</title>
		<meta name="description" content="${options.description}" />
		<meta name="og:description" content="${options.description}" />
	</head>

	<body>
		<div id="app"></div>

		<!-- Load the Script -->
		<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>

		<!-- Initialize the Scalar API Reference -->
		<script>
			Scalar.createApiReference('#app', {
			// The URL of the OpenAPI/Swagger document
			url: '/openapi.json',
		})
		</script>
	</body>
	</html>`;

const swagger = (options: { title: string; description: string }) =>
	`<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${options.title}</title>
		<meta name="description" content="${options.description}" />
		<meta name="og:description" content="${options.description}" />
		<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
	</head>
	<body>
		<div id="swagger-ui"></div>
		<script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
		<script>window.onload = () => { window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: '#swagger-ui' }); };</script>
	</body>
	</html>`;
