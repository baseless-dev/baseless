import { App, app, AppRegistry, EndpointDefinition } from "../app.ts";
import * as z from "@baseless/core/schema";
import type { OpenAPIV3 } from "openapi-types";
import { Response } from "@baseless/core/response";

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
	return zodRequestToOpenAPIPathsObject(path, definition.request, definition.response);
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

type RequestSchemaMetadata = {
	summary?: string;
	description?: string;
	method: string;
	headers: z.ZodObject;
	searchParams: z.ZodObject;
	body: z.ZodType;
};

type ResponseSchemaMetadata = {
	status: number;
	description?: string;
	headers: z.ZodObject;
	body: z.ZodType;
};

type FormDataSchemaMetadata = {
	schema: z.ZodObject;
};

type ReadableStreamSchemaMetadata = {
	kind: "readableStream";
};

type JSONSchemaNode = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

type ClonableZodSchema = z.ZodType & {
	def: Record<string, unknown>;
	clone(def: Record<string, unknown>): z.ZodType;
};

const OPENAPI_HTTP_METHODS = new Set<string>([
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
]);

/**
 * Converts JSON-schema-compatible Zod schemas to OpenAPI 3.0 schema objects.
 */
export function zodSchemaToOpenAPISchema(schema: z.ZodType): OpenAPIV3.SchemaObject {
	try {
		return normalizeOpenAPISchema(toJSONSchema(schema) as OpenAPIV3.SchemaObject);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new TypeError(`Only JSON-schema-compatible Zod schemas can be converted to OpenAPI for now: ${message}`);
	}
}

function toJSONSchema(schema: z.ZodType): JSONSchemaNode {
	return z.toJSONSchema(rewriteZodSchemaForJSONSchema(schema), { target: "openapi-3.0" }) as JSONSchemaNode;
}

function rewriteZodSchemaForJSONSchema(schema: z.ZodType, allowUnknownFallback = false): z.ZodType {
	const formDataSchema = getFormDataObjectSchema(schema);
	if (formDataSchema) {
		return rewriteZodSchemaForJSONSchema(formDataSchema, allowUnknownFallback);
	}

	if (isReadableStreamSchema(schema)) {
		return z.file();
	}

	const def = schema.def as {
		type?: string;
		shape?: Record<string, z.ZodType>;
		catchall?: z.ZodType;
		element?: z.ZodType;
		options?: readonly z.ZodType[];
		innerType?: z.ZodType;
		items?: readonly z.ZodType[];
		rest?: z.ZodType | null;
		keyType?: z.ZodType;
		valueType?: z.ZodType;
		left?: z.ZodType;
		right?: z.ZodType;
		getter?: () => z.ZodType;
	};

	if (def.type === "custom") {
		return allowUnknownFallback ? z.unknown() : schema;
	}

	switch (def.type) {
		case "object":
			return cloneZodSchema(schema, {
				...schema.def,
				shape: Object.fromEntries(
					Object.entries(def.shape ?? {}).map(([key, value]) => [key, rewriteZodSchemaForJSONSchema(value, true)]),
				),
				...(def.catchall instanceof z.ZodType ? { catchall: rewriteZodSchemaForJSONSchema(def.catchall, true) } : {}),
			});

		case "array":
			if (def.element instanceof z.ZodType) {
				return cloneZodSchema(schema, {
					...schema.def,
					element: rewriteZodSchemaForJSONSchema(def.element, true),
				});
			}
			return schema;

		case "union":
			if (Array.isArray(def.options)) {
				return cloneZodSchema(schema, {
					...schema.def,
					options: def.options.map((option) => rewriteZodSchemaForJSONSchema(option, true)),
				});
			}
			return schema;

		case "tuple":
			if (Array.isArray(def.items)) {
				return cloneZodSchema(schema, {
					...schema.def,
					items: def.items.map((item) => rewriteZodSchemaForJSONSchema(item, true)),
					...(def.rest instanceof z.ZodType ? { rest: rewriteZodSchemaForJSONSchema(def.rest, true) } : {}),
				});
			}
			return schema;

		case "record":
			if (def.keyType instanceof z.ZodType && def.valueType instanceof z.ZodType) {
				return cloneZodSchema(schema, {
					...schema.def,
					keyType: rewriteZodSchemaForJSONSchema(def.keyType, true),
					valueType: rewriteZodSchemaForJSONSchema(def.valueType, true),
				});
			}
			return schema;

		case "intersection":
			if (def.left instanceof z.ZodType && def.right instanceof z.ZodType) {
				return cloneZodSchema(schema, {
					...schema.def,
					left: rewriteZodSchemaForJSONSchema(def.left, true),
					right: rewriteZodSchemaForJSONSchema(def.right, true),
				});
			}
			return schema;

		case "lazy":
			if (typeof def.getter === "function") {
				return cloneZodSchema(schema, {
					...schema.def,
					getter: () => rewriteZodSchemaForJSONSchema(def.getter!(), true),
				});
			}
			return schema;

		default:
			if (def.innerType instanceof z.ZodType) {
				return cloneZodSchema(schema, {
					...schema.def,
					innerType: rewriteZodSchemaForJSONSchema(def.innerType, true),
				});
			}
			return schema;
	}
}

function cloneZodSchema(schema: z.ZodType, def: Record<string, unknown>): z.ZodType {
	return (schema as ClonableZodSchema).clone(def);
}

function normalizeOpenAPISchema(schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject {
	return normalizeOpenAPISchemaNode(schema) as OpenAPIV3.SchemaObject;
}

function normalizeOpenAPISchemaNode(
	node: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject {
	if ("$ref" in node) {
		return node;
	}

	const { contentEncoding: _contentEncoding, ...normalizedNodeValue } = node as OpenAPIV3.SchemaObject & {
		contentEncoding?: unknown;
	};
	const normalizedNode = normalizedNodeValue as OpenAPIV3.SchemaObject & {
		items?: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
		additionalProperties?: boolean | OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
		not?: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
	};

	if (normalizedNode.properties) {
		normalizedNode.properties = Object.fromEntries(
			Object.entries(normalizedNode.properties).map(([key, value]) => [key, normalizeOpenAPISchemaNode(value)]),
		);
	}

	if (normalizedNode.items && typeof normalizedNode.items === "object") {
		normalizedNode.items = normalizeOpenAPISchemaNode(normalizedNode.items);
	}

	if (normalizedNode.additionalProperties && typeof normalizedNode.additionalProperties === "object") {
		normalizedNode.additionalProperties = normalizeOpenAPISchemaNode(normalizedNode.additionalProperties);
	}

	if (normalizedNode.allOf) {
		normalizedNode.allOf = normalizedNode.allOf.map(normalizeOpenAPISchemaNode);
	}

	if (normalizedNode.anyOf) {
		normalizedNode.anyOf = normalizedNode.anyOf.map(normalizeOpenAPISchemaNode);
	}

	if (normalizedNode.oneOf) {
		normalizedNode.oneOf = normalizedNode.oneOf.map(normalizeOpenAPISchemaNode);
	}

	if (normalizedNode.not && typeof normalizedNode.not === "object") {
		normalizedNode.not = normalizeOpenAPISchemaNode(normalizedNode.not);
	}

	return normalizedNode;
}

/**
 * Converts a custom request schema into an OpenAPI paths object entry.
 */
export function zodRequestToOpenAPIPathsObject(
	path: string,
	requestSchema: z.ZodType,
	responseSchema?: z.ZodType,
): OpenAPIV3.PathsObject {
	const metadata = getRequestSchemaMetadata(requestSchema);
	const parameters = [
		...zodObjectToOpenAPIParameters(metadata.headers, "header"),
		...zodObjectToOpenAPIParameters(metadata.searchParams, "query"),
	];
	const operation: OpenAPIV3.OperationObject = {
		responses: zodResponseToOpenAPIResponsesObject(responseSchema),
	};

	if (metadata.summary) {
		operation.summary = metadata.summary;
	}

	if (metadata.description) {
		operation.description = metadata.description;
	}

	if (parameters.length > 0) {
		operation.parameters = parameters;
	}

	const requestBody = zodBodyToOpenAPIRequestBody(metadata.headers, metadata.body);
	if (requestBody) {
		operation.requestBody = requestBody;
	}

	return {
		[normalizeOpenAPIPath(path)]: {
			[normalizeOpenAPIHttpMethod(metadata.method)]: operation,
		},
	};
}

function getRequestSchemaMetadata(schema: z.ZodType): RequestSchemaMetadata {
	const def = schema.def as { type?: string; params?: unknown };
	if (def.type !== "custom" || !isRequestSchemaMetadata(def.params)) {
		throw new TypeError("Only z.request-compatible schemas can be converted to OpenAPI paths for now.");
	}
	return def.params;
}

function isRequestSchemaMetadata(value: unknown): value is RequestSchemaMetadata {
	if (!value || typeof value !== "object") {
		return false;
	}

	const metadata = value as Partial<RequestSchemaMetadata>;
	return typeof metadata.method === "string" &&
		metadata.headers instanceof z.ZodObject &&
		metadata.searchParams instanceof z.ZodObject &&
		metadata.body instanceof z.ZodType;
}

function zodResponseToOpenAPIResponsesObject(schema?: z.ZodType): OpenAPIV3.ResponsesObject {
	if (!schema) {
		return {};
	}

	const responses: OpenAPIV3.ResponsesObject = {};
	for (const metadata of getResponseSchemaMetadataList(schema)) {
		const statusCode = String(metadata.status);
		const existingResponse = responses[statusCode];
		const response = (!existingResponse || "$ref" in existingResponse) ? { description: metadata.description ?? "" } : existingResponse;

		if (!response.description && metadata.description) {
			response.description = metadata.description;
		}

		const headers = zodObjectToOpenAPIResponseHeaders(metadata.headers);
		if (Object.keys(headers).length > 0) {
			response.headers = { ...response.headers, ...headers };
		}

		const content = zodBodyToOpenAPIContent(metadata.headers, metadata.body);
		if (content) {
			response.content = { ...response.content, ...content };
		}

		responses[statusCode] = response;
	}

	return responses;
}

function getResponseSchemaMetadataList(schema: z.ZodType): ResponseSchemaMetadata[] {
	const def = schema.def as { type?: string; options?: readonly z.ZodType[]; params?: unknown };
	if (def.type === "custom" && isResponseSchemaMetadata(def.params)) {
		return [def.params];
	}

	if (def.type === "union" && Array.isArray(def.options)) {
		return def.options.map((option) => getSingleResponseSchemaMetadata(option));
	}

	throw new TypeError("Only z.response-compatible schemas can be converted to OpenAPI responses for now.");
}

function getSingleResponseSchemaMetadata(schema: z.ZodType): ResponseSchemaMetadata {
	const def = schema.def as { type?: string; params?: unknown };
	if (def.type !== "custom" || !isResponseSchemaMetadata(def.params)) {
		throw new TypeError("Only z.response-compatible schemas can be converted to OpenAPI responses for now.");
	}
	return def.params;
}

function isResponseSchemaMetadata(value: unknown): value is ResponseSchemaMetadata {
	if (!value || typeof value !== "object") {
		return false;
	}

	const metadata = value as Partial<ResponseSchemaMetadata>;
	return typeof metadata.status === "number" &&
		(metadata.description === undefined || typeof metadata.description === "string") &&
		metadata.headers instanceof z.ZodObject &&
		metadata.body instanceof z.ZodType;
}

function getFormDataObjectSchema(schema: z.ZodType): z.ZodObject | undefined {
	const def = schema.def as { type?: string; params?: unknown };
	if (def.type !== "custom" || !isFormDataSchemaMetadata(def.params)) {
		return undefined;
	}

	return def.params.schema;
}

function isFormDataSchemaMetadata(value: unknown): value is FormDataSchemaMetadata {
	if (!value || typeof value !== "object") {
		return false;
	}

	const metadata = value as Partial<FormDataSchemaMetadata>;
	return metadata.schema instanceof z.ZodObject;
}

function isReadableStreamSchema(schema: z.ZodType): boolean {
	const def = schema.def as { type?: string; params?: unknown };
	return def.type === "custom" && isReadableStreamSchemaMetadata(def.params);
}

function isReadableStreamSchemaMetadata(value: unknown): value is ReadableStreamSchemaMetadata {
	if (!value || typeof value !== "object") {
		return false;
	}

	const metadata = value as Partial<ReadableStreamSchemaMetadata>;
	return metadata.kind === "readableStream";
}

function zodObjectToOpenAPIParameters(
	schema: z.ZodObject,
	inLocation: "header" | "query",
): OpenAPIV3.ParameterObject[] {
	const objectSchema = zodSchemaToOpenAPISchema(schema);
	const required = new Set(objectSchema.required ?? []);

	return Object.entries(objectSchema.properties ?? {}).flatMap(([name, propertySchema]) => {
		if (inLocation === "header" && name.toLowerCase() === "content-type") {
			return [];
		}

		return [{
			name,
			in: inLocation,
			required: required.has(name),
			schema: propertySchema,
		}];
	});
}

function zodObjectToOpenAPIResponseHeaders(
	schema: z.ZodObject,
): NonNullable<OpenAPIV3.ResponseObject["headers"]> {
	const objectSchema = zodSchemaToOpenAPISchema(schema);

	return Object.fromEntries(
		Object.entries(objectSchema.properties ?? {}).flatMap(([name, propertySchema]) => {
			if (name.toLowerCase() === "content-type") {
				return [];
			}

			return [[name, { schema: propertySchema } satisfies OpenAPIV3.HeaderObject]];
		}),
	) as NonNullable<OpenAPIV3.ResponseObject["headers"]>;
}

function zodBodyToOpenAPIRequestBody(
	headers: z.ZodObject,
	body: z.ZodType,
): OpenAPIV3.RequestBodyObject | undefined {
	const content = zodBodyToOpenAPIContent(headers, body);
	if (!content) {
		return undefined;
	}

	return {
		required: true,
		content,
	};
}

function zodBodyToOpenAPIContent(
	headers: z.ZodObject,
	body: z.ZodType,
): OpenAPIV3.ResponseObject["content"] | undefined {
	if (body instanceof z.ZodNull || body instanceof z.ZodUndefined) {
		return undefined;
	}

	const schema = zodSchemaToOpenAPISchema(body);
	return Object.fromEntries(
		getRequestBodyContentTypes(headers, body).map((mediaType) => [mediaType, { schema }]),
	) as OpenAPIV3.ResponseObject["content"];
}

function getRequestBodyContentTypes(headers: z.ZodObject, body: z.ZodType): string[] {
	const headersSchema = zodSchemaToOpenAPISchema(headers);
	const contentType = headersSchema.properties?.["content-type"];
	const mediaTypes = getStringEnumValues(contentType);
	if (mediaTypes.length > 0) {
		return mediaTypes;
	}

	if (getFormDataObjectSchema(body)) {
		return ["multipart/form-data"];
	}

	if (isReadableStreamSchema(body)) {
		return ["application/octet-stream"];
	}

	if (body instanceof z.ZodString) {
		return ["text/plain"];
	}

	return ["application/json"];
}

function getStringEnumValues(schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | undefined): string[] {
	if (!schema || "$ref" in schema || !schema.enum) {
		return [];
	}

	return schema.enum.filter((value): value is string => typeof value === "string");
}

function normalizeOpenAPIHttpMethod(method: string): OpenAPIV3.HttpMethods {
	const normalizedMethod = method.toLowerCase() as OpenAPIV3.HttpMethods;
	if (!OPENAPI_HTTP_METHODS.has(normalizedMethod)) {
		throw new TypeError(`Unsupported HTTP method for OpenAPI conversion: ${method}`);
	}
	return normalizedMethod;
}

function normalizeOpenAPIPath(path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return normalizedPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}
