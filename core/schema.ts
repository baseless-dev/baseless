// deno-lint-ignore-file ban-types no-explicit-any
import * as z from "zod";
import { ID, isID } from "./id.ts";
import { isReference, Reference } from "./ref.ts";
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
	const schema = z.strictObject(properties ?? {});
	return z.custom<TypedFormData>((val) => val instanceof FormData && schema.safeParse(Object.fromEntries(val)).success);
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
export type ZodId<Prefix extends string = ""> = z.ZodCustom<ID<Prefix>, unknown>;

/**
 * Creates a Zod schema that validates branded {@link ID} strings.
 * @param prefix Optional ID prefix (e.g. `"usr_"`).
 * @returns A Zod schema accepting only valid IDs with the given prefix.
 */
export function id(): ZodId;
export function id<const Prefix extends string>(prefix: Prefix): ZodId<Prefix>;
export function id(prefix?: string): ZodId {
	return z.custom<ID>(
		(val) => isID(prefix as never, val),
		"invalid ID",
	);
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
		"invalid ReadableStream",
	);
}

/** Zod type for a typed {@link Reference} string. */
export type ZodReference<Path extends string> = z.ZodCustom<Reference<Path>, unknown>;

/**
 * Creates a Zod schema that validates {@link Reference} strings matching
 * the given `path` template.
 * @param path A path template string (e.g. `"/users/:id"`).
 * @returns A Zod schema accepting matching reference strings.
 */
export function reference<const Path extends string>(path: Path): ZodReference<Path> {
	return z.custom<Reference<Path>>(
		(val) => isReference(path as never, val),
		"invalid Reference",
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
		| ZodFormData
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
		| ZodFormData
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
