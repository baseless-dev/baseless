// deno-lint-ignore-file ban-types no-explicit-any
import { TypedFormData, TypedHeaders, TypedURL } from "@baseless/core/typed";
import type * as z from "zod";

export type RequestInit<THeaders extends Record<string, string | undefined>> = Omit<globalThis.RequestInit, "headers"> & {
	headers?: THeaders;
};

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

	get body(): TBody {
		return this.#body;
	}

	get bodyUsed(): boolean {
		return this.#request.bodyUsed;
	}

	get cache(): RequestCache {
		return this.#request.cache;
	}

	get credentials(): RequestCredentials {
		return this.#request.credentials;
	}

	get destination(): RequestDestination {
		return this.#request.destination;
	}

	get headers(): TypedHeaders<THeaders> {
		return this.#request.headers as TypedHeaders<THeaders>;
	}

	get integrity(): string {
		return this.#request.integrity;
	}

	get isHistoryNavigation(): boolean {
		return this.#request.isHistoryNavigation;
	}

	get isReloadNavigation(): boolean {
		return this.#request.isReloadNavigation;
	}

	get keepalive(): boolean {
		return this.#request.keepalive;
	}

	get method(): TMethod {
		return this.#request.method as TMethod;
	}

	get mode(): RequestMode {
		return this.#request.mode;
	}

	get redirect(): RequestRedirect {
		return this.#request.redirect;
	}

	get referrer(): string {
		return this.#request.referrer;
	}

	get referrerPolicy(): ReferrerPolicy {
		return this.#request.referrerPolicy;
	}

	get signal(): AbortSignal {
		return this.#request.signal;
	}

	get url(): TypedURL<TSearchParams> {
		return this.#url;
	}

	clone(): Request<TMethod, THeaders, TSearchParams, TBody> {
		return new Request(this.#request.clone(), this.#body);
	}

	toRequest(): globalThis.Request {
		return this.#request;
	}
}
