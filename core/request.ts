// deno-lint-ignore-file ban-types no-explicit-any
import { TypedFormData, TypedHeaders, TypedURL } from "@baseless/core/typed";
import type * as z from "zod";

/**
 * A strongly-typed drop-in for the standard `RequestInit` that constrains the
 * `headers` property to the given `THeaders` record type.
 */
export type RequestInit<THeaders extends Record<string, string | undefined>> = Omit<globalThis.RequestInit, "headers"> & {
	headers?: THeaders;
};

/**
 * A strongly-typed wrapper around the platform `Request` API that carries
 * generic type parameters for the HTTP method, request headers, URL search
 * params, and parsed body. Used throughout Baseless for type-safe endpoint
 * definitions.
 *
 * @template TMethod HTTP method string (e.g. `"GET"`, `"POST"`).
 * @template THeaders Record of known header names to their value types.
 * @template TSearchParams Record of known query-parameter names to their value types.
 * @template TBody The type of the parsed request body.
 */
export class Request<
	const TMethod extends string = "GET",
	const THeaders extends Record<string, string | undefined> = {},
	const TSearchParams extends Record<string, string | undefined> = {},
	const TBody extends
		| Record<string, unknown>
		| Array<unknown>
		| unknown
		| TypedFormData<any>
		| ReadableStream<Uint8Array<ArrayBufferLike>>
		| string
		| null = null,
> {
	#request: globalThis.Request;
	#url: TypedURL<TSearchParams>;
	#body: TBody;

	/**
	 * Creates a typed {@link Request} by parsing the body of a native `Request`
	 * according to its `Content-Type` header.
	 * Supports `application/json`, `application/x-www-form-urlencoded`,
	 * `multipart/form-data`, and `text/plain`.
	 *
	 * @param input The URL or native `RequestInfo` to fetch.
	 * @param init Optional typed request init options.
	 * @returns A `Promise` resolving to a typed {@link Request}.
	 */
	static async from<
		const TMethod extends string,
		const THeaders extends Record<string, string | undefined>,
		const TSearchParams extends Record<string, string | undefined>,
		const TBody extends
			| unknown
			| TypedFormData<any>
			| ReadableStream<Uint8Array<ArrayBufferLike>>
			| string
			| null,
	>(input: RequestInfo | globalThis.URL, init?: RequestInit<THeaders>): Promise<Request<TMethod, THeaders, TSearchParams, TBody>> {
		const request = new globalThis.Request(input, init as never);
		const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
		let body: TBody;
		if (contentType.startsWith("application/json")) {
			body = await request.json().catch((_) => null) as TBody;
		} else if (contentType === "application/x-www-form-urlencoded") {
			body = Object.fromEntries(new URLSearchParams(await request.text())) as TBody;
		} else if (contentType.startsWith("multipart/form-data")) {
			body = await request.formData() as TBody;
		} else if (contentType.startsWith("text/plain")) {
			body = await request.text() as TBody;
		} else {
			body = request.body as TBody;
		}
		return new Request(request, body);
	}

	/**
	 * Creates a JSON POST {@link Request} with body serialized to JSON and the
	 * appropriate `Content-Type` header.
	 *
	 * @param json The data to serialize.
	 * @param input Optional target URL (defaults to `"http://local"`).
	 * @param init Additional request init options.
	 * @returns A `Promise` resolving to a typed {@link Request}.
	 */
	static json<
		THeaders extends Record<string, string> = {},
		TData extends unknown = {},
	>(
		json: TData,
		input?: RequestInfo | globalThis.URL,
		init?: Omit<RequestInit<THeaders>, "body" | "method">,
	): Promise<Request<"POST", THeaders & { "content-type": "application/json" }, {}, TData>> {
		return Request.from<any, any, any, any>(input ?? "http://local", {
			...init,
			method: "POST",
			headers: { ...init?.headers, "content-type": "application/json" },
			body: JSON.stringify(json),
		});
	}

	constructor(request: globalThis.Request, body: TBody) {
		this.#request = request;
		this.#url = new globalThis.URL(this.#request.url) as TypedURL<TSearchParams>;
		this.#body = body;
	}

	/** The parsed request body. */
	get body(): TBody {
		return this.#body;
	}

	/** Whether the body has already been consumed. */
	get bodyUsed(): boolean {
		return this.#request.bodyUsed;
	}

	/** The cache mode used for the request. */
	get cache(): RequestCache {
		return this.#request.cache;
	}

	/** The credentials mode used for cross-origin requests. */
	get credentials(): RequestCredentials {
		return this.#request.credentials;
	}

	/** The destination of the request (e.g. `"document"`, `"script"`, `""`). */
	get destination(): RequestDestination {
		return this.#request.destination;
	}

	/** Typed headers map. */
	get headers(): TypedHeaders<THeaders> {
		return this.#request.headers as TypedHeaders<THeaders>;
	}

	/** Subresource integrity value of the request. */
	get integrity(): string {
		return this.#request.integrity;
	}

	/** Whether the request is a history navigation (back/forward). */
	get isHistoryNavigation(): boolean {
		return this.#request.isHistoryNavigation;
	}

	/** Whether the request is triggered by a page reload. */
	get isReloadNavigation(): boolean {
		return this.#request.isReloadNavigation;
	}

	/** Whether the connection should be kept alive after the response. */
	get keepalive(): boolean {
		return this.#request.keepalive;
	}

	/** HTTP method string. */
	get method(): TMethod {
		return this.#request.method as TMethod;
	}

	/** The CORS mode of the request (e.g. `"cors"`, `"no-cors"`, `"same-origin"`). */
	get mode(): RequestMode {
		return this.#request.mode;
	}

	/** How redirects are handled for this request. */
	get redirect(): RequestRedirect {
		return this.#request.redirect;
	}

	/** The referrer URL string of the request. */
	get referrer(): string {
		return this.#request.referrer;
	}

	/** The referrer policy governing how much referrer info is sent. */
	get referrerPolicy(): ReferrerPolicy {
		return this.#request.referrerPolicy;
	}

	/** The `AbortSignal` associated with this request. */
	get signal(): AbortSignal {
		return this.#request.signal;
	}

	/** Typed URL including strongly-typed search params. */
	get url(): TypedURL<TSearchParams> {
		return this.#url;
	}

	/**
	 * Creates a shallow clone of this request.
	 * @returns A new {@link Request} instance with the same properties.
	 */
	clone(): Request<TMethod, THeaders, TSearchParams, TBody> {
		return new Request(this.#request.clone(), this.#body);
	}

	/**
	 * Converts this typed request back to a native `Request`.
	 * @returns The underlying `globalThis.Request` instance.
	 */
	toRequest(): globalThis.Request {
		return this.#request;
	}
}
