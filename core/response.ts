// deno-lint-ignore-file no-explicit-any ban-types
import { TypedFormData, TypedHeaders } from "@baseless/core/typed";
import type * as z from "zod";

/** A value accepted wherever a URL string or typed {@link Response} is expected. */
export type RequestInfo = Response<any, any, any> | string;

/**
 * Typed initialization options for constructing a {@link Response}.
 *
 * @template TStatus The HTTP status code type.
 * @template THeaders Record of known response headers.
 */
export interface ResponseInit<
	TStatus extends number,
	THeaders extends Record<string, string | undefined>,
> {
	headers?: THeaders;
	status?: TStatus;
	statusText?: string;
	description?: string;
}

/**
 * A strongly-typed wrapper around an HTTP response.
 * Carries generic type parameters for the status code, response headers, and
 * parsed body to enable end-to-end type safety through Baseless endpoints.
 *
 * @template TStatus HTTP status code (e.g. `200`, `404`).
 * @template THeaders Record of known header names to their value types.
 * @template TBody The type of the response body.
 */
export class Response<
	const TStatus extends number = number,
	const THeaders extends Record<string, string | undefined> = Record<string, string | undefined>,
	const TBody extends
		| Record<string, unknown>
		| Array<unknown>
		| unknown
		| TypedFormData<any>
		| ReadableStream<Uint8Array<ArrayBufferLike>>
		| string
		| undefined = unknown,
> {
	#body: TBody;
	#headers: TypedHeaders<THeaders>;
	#status: TStatus;
	#statusText: string;
	#description?: string;

	/**
	 * Creates a typed {@link Response} by parsing the body of a native `Response`
	 * according to its `Content-Type` header.
	 *
	 * @param response The native response to parse.
	 * @returns A `Promise` resolving to a typed {@link Response}.
	 */
	static async from<
		const TStatus extends number,
		const THeaders extends Record<string, string | undefined>,
		const TBody extends
			| unknown
			| TypedFormData<any>
			| ReadableStream<Uint8Array<ArrayBufferLike>>
			| string
			| null,
	>(response: globalThis.Response): Promise<Response<TStatus, THeaders, TBody>> {
		const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
		let body: TBody;
		if (contentType.startsWith("application/json")) {
			body = await response.json().catch((_) => null) as TBody;
		} else if (contentType === "application/x-www-form-urlencoded") {
			body = Object.fromEntries(new URLSearchParams(await response.text())) as TBody;
		} else if (contentType.startsWith("multipart/form-data")) {
			body = await response.formData() as TBody;
		} else if (contentType.startsWith("text/plain")) {
			body = await response.text() as TBody;
		} else {
			body = response.body as TBody;
		}
		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers: Object.fromEntries(response.headers.entries()),
		}) as never;
	}

	constructor(body: TBody, init?: ResponseInit<TStatus, THeaders>) {
		this.#body = body;
		this.#headers = new Headers(init?.headers as never) as TypedHeaders<THeaders>;
		this.#status = init?.status ?? 200 as TStatus;
		this.#statusText = init?.statusText ?? "OK";
		this.#description = init?.description;
	}

	/**
	 * Creates a JSON {@link Response} with the given data serialized as JSON and
	 * `Content-Type: application/json`.
	 *
	 * @param data The data to serialize.
	 * @param init Optional status / header overrides.
	 * @returns A typed {@link Response}.
	 */
	static json<const TData = unknown>(data: TData): Response<200, { "content-type": "application/json" }, TData>;
	static json<
		const TStatus extends number = 200,
		const THeaders extends Record<string, string> = {},
		const TData = unknown,
	>(data: TData, init?: ResponseInit<TStatus, THeaders>): Response<TStatus, THeaders & { "content-type": "application/json" }, TData>;
	static json(data: unknown, init?: ResponseInit<number, Record<string, string>>): Response<any, any, any> {
		return new Response<any, any, any>(data, {
			...init,
			headers: {
				...init,
				"content-type": "application/json",
			},
		});
	}

	/**
	 * Creates a plain-text `200` {@link Response}.
	 * @param data The text body.
	 * @param init Optional header overrides.
	 * @returns A typed text {@link Response}.
	 */
	static text(data: string, init?: ResponseInit<number, Record<string, string>>): Response<200, { "content-type": "text/plain" }, string> {
		return new Response<200, { "content-type": "text/plain" }, string>(data, {
			...init,
			status: 200,
			headers: {
				...init,
				"content-type": "text/plain",
			},
		});
	}

	/**
	 * Creates a `500 Internal Server Error` {@link Response} with no body.
	 * @returns A typed error {@link Response}.
	 */
	static error(): Response<500, {}, undefined> {
		return new Response(undefined, {
			status: 500,
		});
	}

	/**
	 * Creates an HTTP redirect {@link Response}.
	 * @param url The target URL.
	 * @param status The redirect status code (defaults to `301`).
	 * @returns A typed redirect {@link Response}.
	 */
	static redirect<TStatus extends number = 301>(url: string | URL, status?: TStatus): Response<TStatus, { "Location": string }, undefined> {
		return new Response(undefined, {
			status: status ?? 301 as TStatus,
			headers: {
				"Location": url.toString(),
			},
		});
	}

	/** The parsed response body. */
	get body(): TBody {
		return this.#body;
	}

	/** Typed response headers map. */
	get headers(): TypedHeaders<THeaders> {
		return this.#headers;
	}

	/** `true` when the status code is `200`. */
	get ok(): boolean {
		return this.#status === 200;
	}

	/** `true` when the status code is in the `3xx` range. */
	get redirected(): boolean {
		return this.status >= 300 || this.status < 400;
	}

	/** HTTP status code. */
	get status(): TStatus {
		return this.#status;
	}

	/** HTTP status text. */
	get statusText(): string {
		return this.#statusText;
	}

	/** Optional human-readable description of the response (used in OpenAPI). */
	get description(): string | undefined {
		return this.#description;
	}

	/**
	 * Creates a shallow clone of this response.
	 * @returns A new {@link Response} instance with the same properties.
	 */
	clone(): Response<TStatus, THeaders, TBody> {
		return new Response<TStatus, THeaders, TBody>(this.#body, {
			status: this.#status,
			statusText: this.#statusText,
			description: this.#description,
			headers: Object.fromEntries(this.#headers) as never as THeaders,
		});
	}

	/**
	 * Serializes this typed response to a native `Response`.
	 * JSON-encodes the body and sets the `Content-Type` header when the body
	 * is not already a string, `FormData`, or `ReadableStream`.
	 * @returns A native `globalThis.Response`.
	 */
	toResponse(): globalThis.Response {
		let body: BodyInit | null;
		const headers = Object.fromEntries(this.#headers) as Record<string, string>;
		if (typeof this.#body === "string" || this.#body instanceof FormData || this.#body instanceof ReadableStream) {
			body = this.#body;
		} else {
			body = JSON.stringify(this.#body);
			headers["content-type"] = "application/json";
		}
		return new globalThis.Response(body, {
			status: this.#status,
			statusText: this.#statusText,
			headers,
		});
	}
}
