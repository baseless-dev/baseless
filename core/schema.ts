// deno-lint-ignore-file ban-types no-explicit-any
import * as z from "zod";
import { ID, isID } from "./id.ts";
import { isReference, Reference } from "./ref.ts";
import type { TypedFormData } from "./typed.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";

export * from "zod";

export function assert<TSchema extends z.ZodType>(schema: TSchema, data: unknown): asserts data is z.infer<TSchema> {
	const result = schema.safeParse(data);
	if (!result.success) {
		throw result.error;
	}
}

export type ZodFormData<TData extends Record<string, string | File> = Record<string, string | File>> = z.ZodCustom<
	TypedFormData<TData>,
	unknown
>;

export function formData(): ZodFormData;
export function formData<const Properties extends Record<string, z.ZodString | z.ZodFile>>(
	properties: Properties,
): ZodFormData<{ [k in keyof Properties]: z.infer<Properties[k]> }>;
export function formData(properties?: Record<string, z.ZodString | z.ZodFile>): ZodFormData {
	const schema = z.strictObject(properties ?? {});
	return z.custom<TypedFormData>((val) => val instanceof FormData && schema.safeParse(Object.fromEntries(val)).success);
}

export function guard<TSchema extends z.ZodType>(schema: TSchema, data: unknown): data is z.infer<TSchema> {
	return schema.safeParse(data).success;
}

export type ZodId<Prefix extends string = ""> = z.ZodCustom<ID<Prefix>, unknown>;

export function id(): ZodId;
export function id<const Prefix extends string>(prefix: Prefix): ZodId<Prefix>;
export function id(prefix?: string): ZodId {
	return z.custom<ID>(
		(val) => isID(prefix as never, val),
		"invalid ID",
	);
}

export type ZodReadableStream = z.ZodCustom<ReadableStream, unknown>;

export function readableStream(): ZodReadableStream {
	return z.custom<ReadableStream>(
		(val) => val instanceof ReadableStream,
		"invalid ReadableStream",
	);
}

export type ZodReference<Path extends string> = z.ZodCustom<Reference<Path>, unknown>;

export function reference<const Path extends string>(path: Path): ZodReference<Path> {
	return z.custom<Reference<Path>>(
		(val) => isReference(path as never, val),
		"invalid Reference",
	);
}

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

export function textRequest(): ZodRequest<"POST", { "content-type": "text/plain" }, {}, string> {
	return request({ method: "POST", headers: { "content-type": z.literal("text/plain") }, body: z.string() }) as never;
}

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

export function textResponse(): ZodResponse<200, { "content-type": "text/plain" }, string> {
	return response({ status: 200, headers: { "content-type": z.literal("text/plain") }, body: z.string() }) as never;
}
