// deno-lint-ignore-file ban-types no-explicit-any
import * as z from "zod";
import type { OpenAPIV3 } from "openapi-types";
import { ID } from "./id.ts";
import type { TypedFormData } from "./typed.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

export * from "zod";

/**
 * Asserts that `data` matches `schema`, throwing a `ZodError` if not.
 * @param schema The Zod schema to validate against.
 * @param data The value to validate.
 * @throws {ZodError} When validation fails.
 */
export function assert<TSchema extends z.ZodType>(schema: TSchema, data: unknown): asserts data is z.infer<TSchema> {
	const result = schema.safeParse(data);
	if (!result.success) {
		throw result.error;
	}
}

/** Zod type for a {@link TypedFormData} value. */
export type ZodFormData<TData extends Record<string, string | File> = Record<string, string | File>> = z.ZodCustom<
	TypedFormData<TData>,
	unknown
>;

type AnyZodFormData = ZodFormData<any>;

/**
 * Creates a Zod validator for a {@link TypedFormData} value.
 * When `properties` is given, validates each field against the corresponding
 * schema; otherwise accepts any `FormData`.
 *
 * @param properties Optional record of field schemas.
 * @returns A Zod schema that accepts matching `FormData` values.
 */
export function formData(): ZodFormData;
export function formData<const Properties extends Record<string, z.ZodString | z.ZodFile>>(
	properties: Properties,
): ZodFormData<{ [k in keyof Properties]: z.infer<Properties[k]> }>;
export function formData(properties?: Record<string, z.ZodString | z.ZodFile>): ZodFormData {
	const schema = properties ? z.strictObject(properties) : z.looseObject({});
	return z.custom<TypedFormData>(
		(val) => val instanceof FormData && schema.safeParse(Object.fromEntries(val)).success,
		{
			error: "invalid FormData",
			params: {
				schema,
			},
		},
	);
}

/**
 * Type-guard version of Zod's `parse`. Returns `true` when `data` satisfies
 * `schema` without throwing.
 * @param schema The Zod schema to validate against.
 * @param data The value to test.
 * @returns `true` if `data` matches the schema.
 */
export function guard<TSchema extends z.ZodType>(schema: TSchema, data: unknown): data is z.infer<TSchema> {
	return schema.safeParse(data).success;
}

/** Zod type for a branded {@link ID} string. */
export type ZodId<Prefix extends string = ""> = z.ZodType<ID<Prefix>, string>;

/**
 * Creates a Zod schema that validates branded {@link ID} strings.
 * @param prefix Optional ID prefix (e.g. `"usr_"`).
 * @returns A Zod schema accepting only valid IDs with the given prefix.
 */
export function id(): ZodId;
export function id<const Prefix extends string>(prefix: Prefix): ZodId<Prefix>;
export function id(prefix?: string): ZodId {
	const normalizedPrefix = prefix ?? "";
	const escapedPrefix = normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return (
		z.string()
			.regex(new RegExp(`^${escapedPrefix}[0-9A-Za-z]{26}$`), "invalid ID")
			.length(normalizedPrefix.length + 26)
	) as unknown as ZodId;
}

/** Zod type for a {@link ReadableStream} value. */
export type ZodReadableStream = z.ZodCustom<ReadableStream, unknown>;

/**
 * Creates a Zod schema that validates `ReadableStream` instances.
 * @returns A Zod schema accepting `ReadableStream` values.
 */
export function readableStream(): ZodReadableStream {
	return z.custom<ReadableStream>(
		(val) => val instanceof ReadableStream,
		{
			error: "invalid ReadableStream",
			params: {
				kind: "readableStream",
			},
		},
	);
}

/** Zod type for a typed {@link Request} instance. */
export type ZodRequest<
	TMethod extends string = "GET",
	THeaders extends Record<string, string | undefined> = {},
	TSearchParams extends Record<string, string | undefined> = {},
	TBody extends
		| Record<string, unknown>
		| Array<unknown>
		| z.util.JSONType
		| TypedFormData<any>
		| ReadableStream<Uint8Array<ArrayBufferLike>>
		| string
		| null = null,
> = z.ZodCustom<Request<TMethod, THeaders, TSearchParams, TBody>, unknown>;

/**
 * Creates a Zod schema that validates typed {@link Request} instances.
 * Matches on HTTP method, headers, search-params, and body schema.
 *
 * @param info Optional configuration (method, headers, searchParams, body).
 * @returns A Zod schema accepting matching {@link Request} objects.
 */
export function request<
	const TMethod extends string = "GET",
	THeaders extends {
		[key: string]:
			| z.ZodString
			| z.ZodLiteral<string>
			| z.ZodTemplateLiteral
			| z.ZodOptional<z.ZodString | z.ZodLiteral<string> | z.ZodTemplateLiteral>;
	} = {},
	TSearchParams extends {
		[key: string]:
			| z.ZodString
			| z.ZodLiteral<string>
			| z.ZodTemplateLiteral
			| z.ZodUnion<(z.ZodString | z.ZodLiteral<string> | z.ZodTemplateLiteral)[]>
			| z.ZodOptional<
				| z.ZodString
				| z.ZodLiteral<string>
				| z.ZodTemplateLiteral
				| z.ZodUnion<(z.ZodString | z.ZodLiteral<string> | z.ZodTemplateLiteral)[]>
			>;
	} = {},
	TBody extends
		| z.ZodObject
		| z.ZodArray
		| z.ZodJSONSchema
		| AnyZodFormData
		| ZodReadableStream
		| z.ZodString
		| z.ZodNull = z.ZodNull,
>(info?: {
	summary?: string;
	description?: string;
	method?: TMethod;
	headers?: THeaders;
	searchParams?: TSearchParams;
	body?: TBody;
}): ZodRequest<
	TMethod,
	{ [k in keyof THeaders]: z.infer<THeaders[k]> },
	{ [k in keyof TSearchParams]: z.infer<TSearchParams[k]> },
	z.infer<TBody>
> {
	const summary = info?.summary;
	const description = info?.description;
	const method = info?.method ?? "GET";
	const headers = z.looseObject(info?.headers ?? {});
	const searchParams = z.strictObject(info?.searchParams ?? {});
	const body = info?.body ?? z.null();
	return z.custom<Request<any, any, any, any>>(
		(val) =>
			val instanceof Request &&
			val.method === method &&
			headers.safeParse(Object.fromEntries(val.headers)).success &&
			searchParams.safeParse(Object.fromEntries(val.url.searchParams)).success &&
			body.safeParse(val.body).success,
		{
			error: "invalid Request",
			params: {
				summary,
				description,
				method,
				headers,
				searchParams,
				body,
			},
		},
	);
}

/**
 * Creates a Zod schema that validates a JSON POST {@link Request}.
 * Shorthand for `request({ method: "POST", headers: { "content-type": "application/json" }, body })`.
 *
 * @param json Optional object-schema for the JSON body fields.
 * @returns A Zod schema accepting matching JSON POST requests.
 */
export function jsonRequest(): ZodRequest<"POST", { "content-type": "application/json" }, {}, z.core.util.JSONType>;
export function jsonRequest<TJson extends Partial<Record<never, z.core.SomeType>>>(
	json: TJson,
): ZodRequest<"POST", { "content-type": "application/json" }, {}, z.infer<z.ZodObject<TJson>>>;
export function jsonRequest<TJson extends Partial<Record<never, z.core.SomeType>>>(
	json?: TJson,
): ZodRequest<"POST", { "content-type": "application/json" }, {}, any> {
	const body = json ? z.strictObject(json) : z.json();
	return request({ method: "POST", headers: { "content-type": z.literal("application/json") }, body }) as never;
}

/**
 * Creates a Zod schema that validates a plain-text POST {@link Request}.
 * @returns A Zod schema accepting `POST` requests with `Content-Type: text/plain`.
 */
export function textRequest(): ZodRequest<"POST", { "content-type": "text/plain" }, {}, string> {
	return request({ method: "POST", headers: { "content-type": z.literal("text/plain") }, body: z.string() }) as never;
}

/** Zod type for a typed {@link Response} instance. */
export type ZodResponse<
	TStatus extends number = 200,
	THeaders extends Record<string, string | undefined> = {},
	TBody extends
		| Record<string, unknown>
		| Array<unknown>
		| unknown
		| TypedFormData<any>
		| ReadableStream<Uint8Array<ArrayBufferLike>>
		| string
		| undefined = undefined,
> = z.ZodCustom<Response<TStatus, THeaders, TBody>, unknown>;

/**
 * Creates a Zod schema that validates typed {@link Response} instances.
 * Matches on status code, headers, and body schema.
 *
 * @param info Optional configuration (status, headers, body).
 * @returns A Zod schema accepting matching {@link Response} objects.
 */
export function response<
	const TStatus extends number = 200,
	THeaders extends {
		[key: string]:
			| z.ZodString
			| z.ZodLiteral<string>
			| z.ZodTemplateLiteral
			| z.ZodOptional<z.ZodString | z.ZodLiteral<string> | z.ZodTemplateLiteral>;
	} = {},
	TBody extends
		| z.ZodObject
		| z.ZodArray
		| z.ZodUnknown
		| AnyZodFormData
		| ZodReadableStream
		| z.ZodString
		| z.ZodUndefined = z.ZodUndefined,
>(info?: {
	status?: TStatus;
	description?: string;
	headers?: THeaders;
	body?: TBody;
}): ZodResponse<TStatus, { [k in keyof THeaders]: z.infer<THeaders[k]> }, z.infer<TBody>> {
	const status = info?.status ?? 200;
	const description = info?.description;
	const headers = z.strictObject(info?.headers ?? {});
	const body = info?.body ?? z.undefined();
	return z.custom<Response<any, any, any>>(
		(val) =>
			val instanceof Response &&
			val.status === status &&
			headers.safeParse(Object.fromEntries(val.headers)).success &&
			body.safeParse(val.body).success,
		{
			error: "invalid Response",
			params: {
				status,
				description,
				headers,
				body,
			},
		},
	);
}

/**
 * Creates a Zod schema that validates a JSON `200` {@link Response}.
 * Shorthand for `response({ status: 200, headers: { "content-type": "application/json" }, body })`.
 *
 * @param json Optional object-schema for the JSON body fields.
 * @returns A Zod schema accepting matching JSON responses.
 */
export function jsonResponse(): ZodResponse<200, { "content-type": "application/json" }, unknown>;
export function jsonResponse<TJson extends Partial<Record<never, z.core.SomeType>>>(
	json: TJson,
): ZodResponse<200, { "content-type": "application/json" }, z.infer<z.ZodObject<TJson>>>;
export function jsonResponse<TJson extends Partial<Record<never, z.core.SomeType>>>(
	json?: TJson,
): ZodResponse<200, { "content-type": "application/json" }, any> {
	const body = json ? z.strictObject(json) : z.unknown();
	return response({ status: 200, headers: { "content-type": z.literal("application/json") }, body }) as never;
}

/**
 * Creates a Zod schema that validates a plain-text `200` {@link Response}.
 * @returns A Zod schema accepting `200` responses with `Content-Type: text/plain`.
 */
export function textResponse(): ZodResponse<200, { "content-type": "text/plain" }, string> {
	return response({ status: 200, headers: { "content-type": z.literal("text/plain") }, body: z.string() }) as never;
}

export type FormDataSchemaMetadata = {
	schema: z.ZodObject;
};

export type ReadableStreamSchemaMetadata = {
	kind: "readableStream";
};

export type JSONSchemaNode = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

export type ClonableZodSchema = z.ZodType & {
	def: Record<string, unknown>;
	clone(def: Record<string, unknown>): z.ZodType;
};

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

export function toJSONSchema(schema: z.ZodType): JSONSchemaNode {
	return z.toJSONSchema(rewriteZodSchemaForJSONSchema(schema), { target: "openapi-3.0" }) as JSONSchemaNode;
}

export function rewriteZodSchemaForJSONSchema(schema: z.ZodType, allowUnknownFallback = false): z.ZodType {
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

export function cloneZodSchema(schema: z.ZodType, def: Record<string, unknown>): z.ZodType {
	return (schema as ClonableZodSchema).clone(def);
}

export function normalizeOpenAPISchema(schema: OpenAPIV3.SchemaObject): OpenAPIV3.SchemaObject {
	return normalizeOpenAPISchemaNode(schema) as OpenAPIV3.SchemaObject;
}

export function normalizeOpenAPISchemaNode(
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

export function zodResponseToOpenAPIResponsesObject(schema?: z.ZodType): OpenAPIV3.ResponsesObject {
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

export function getFormDataObjectSchema(schema: z.ZodType): z.ZodObject | undefined {
	const def = schema.def as { type?: string; params?: unknown };
	if (def.type !== "custom" || !isFormDataSchemaMetadata(def.params)) {
		return undefined;
	}

	return def.params.schema;
}

export function isFormDataSchemaMetadata(value: unknown): value is FormDataSchemaMetadata {
	if (!value || typeof value !== "object") {
		return false;
	}

	const metadata = value as Partial<FormDataSchemaMetadata>;
	return metadata.schema instanceof z.ZodObject;
}

export function isReadableStreamSchema(schema: z.ZodType): boolean {
	const def = schema.def as { type?: string; params?: unknown };
	return def.type === "custom" && isReadableStreamSchemaMetadata(def.params);
}

export function isReadableStreamSchemaMetadata(value: unknown): value is ReadableStreamSchemaMetadata {
	if (!value || typeof value !== "object") {
		return false;
	}

	const metadata = value as Partial<ReadableStreamSchemaMetadata>;
	return metadata.kind === "readableStream";
}
