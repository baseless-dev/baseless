import { App, app, AppRegistry, EndpointDefinition } from "../app.ts";
import * as z from "@baseless/core/schema";
import type { OpenAPIV3 } from "openapi-types";
import { Response } from "@baseless/core/response";

export const zodSchemaToOpenAPISchema = z.zodSchemaToOpenAPISchema;
export const zodRequestToOpenAPIPathsObject = z.zodRequestToOpenAPIPathsObject;

const cache = new WeakMap<App<AppRegistry>, OpenAPIV3.Document>();
const OPENAPI_DOCUMENT_VERSION = "3.0.3";

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
		handler: ({ app, configuration, request }) => {
			const documentPath = configuration.openapi.path ?? "/openapi.json";
			const accept = request.headers.get("Accept");
			if (accept?.includes("text/html")) {
				const options = {
					title: configuration.openapi.info.title,
					description: configuration.openapi.info.description || "",
					url: documentPath,
				};
				const body = request.url.searchParams.get("ui") === "swagger" ? swagger(options) : scalar(options);
				return new Response(body, {
					status: 200,
					headers: { "content-type": "text/html" },
				});
			}

			let document = cache.get(app);
			if (!document) {
				document = createOpenAPIDocument(app, configuration.openapi);
				cache.set(app, document);
			}
			return Response.json(document);
		},
	});

const scalar = (options: { title: string; description: string; url: string }) =>
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

		<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
		<script>
			Scalar.createApiReference('#app', {
				url: '${options.url}',
			});
		</script>
	</body>
	</html>`;

const swagger = (options: { title: string; description: string; url: string }) =>
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
		<script>window.onload = () => { window.ui = SwaggerUIBundle({ url: "${options.url}", dom_id: '#swagger-ui' }); };</script>
	</body>
	</html>`;

export function createOpenAPIDocument(
	app: App<AppRegistry>,
	configuration: {
		info: OpenAPIV3.InfoObject;
		path?: string;
		servers?: OpenAPIV3.ServerObject[];
		tags?: OpenAPIV3.TagObject[];
	},
): OpenAPIV3.Document {
	return {
		openapi: OPENAPI_DOCUMENT_VERSION,
		info: configuration.info,
		...(configuration.servers ? { servers: configuration.servers } : {}),
		...(configuration.tags ? { tags: configuration.tags } : {}),
		...endpointsDefinitionToOpenAPI(app.endpoints),
	};
}

export function endpointsDefinitionToOpenAPI(
	endpoints: App<AppRegistry>["endpoints"],
): Pick<OpenAPIV3.Document, "components" | "paths"> {
	const paths: OpenAPIV3.PathsObject = {};

	for (const [path, verbs] of Object.entries(endpoints)) {
		for (const definition of Object.values(verbs)) {
			mergeOpenAPIPathsObject(paths, endpointDefinitionToOpenAPIPathItem(path, definition));
		}
	}

	return {
		components: {},
		paths,
	};
}

function endpointDefinitionToOpenAPIPathItem(
	path: string,
	definition: EndpointDefinition<AppRegistry, string, z.ZodRequest, z.ZodResponse | z.ZodUnion<z.ZodResponse[]>>,
): OpenAPIV3.PathsObject {
	return z.zodRequestToOpenAPIPathsObject(path, definition.request, definition.response);
}

function mergeOpenAPIPathsObject(
	target: OpenAPIV3.PathsObject,
	next: OpenAPIV3.PathsObject,
): void {
	for (const [path, pathItem] of Object.entries(next)) {
		if (!pathItem) {
			continue;
		}

		target[path] = target[path] ? { ...target[path], ...pathItem } : pathItem;
	}
}
