// deno-lint-ignore-file no-explicit-any ban-types
import { TypedFormData, TypedHeaders } from "@baseless/core/typed";
import type * as z from "zod";

export type RequestInfo = Response<any, any, any> | string;

export interface ResponseInit<
	TStatus extends number,
	THeaders extends Record<string, string | undefined>,
> {
	headers?: THeaders;
	status?: TStatus;
	statusText?: string;
	description?: string;
}

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

	static error(): Response<500, {}, undefined> {
		return new Response(undefined, {
			status: 500,
		});
	}

	static redirect<TStatus extends number = 301>(url: string | URL, status?: TStatus): Response<TStatus, { "Location": string }, undefined> {
		return new Response(undefined, {
			status: status ?? 301 as TStatus,
			headers: {
				"Location": url.toString(),
			},
		});
	}

	get body(): TBody {
		return this.#body;
	}

	get headers(): TypedHeaders<THeaders> {
		return this.#headers;
	}

	get ok(): boolean {
		return this.#status === 200;
	}

	get redirected(): boolean {
		return this.status >= 300 || this.status < 400;
	}

	get status(): TStatus {
		return this.#status;
	}

	get statusText(): string {
		return this.#statusText;
	}

	get description(): string | undefined {
		return this.#description;
	}

	clone(): Response<TStatus, THeaders, TBody> {
		return new Response<TStatus, THeaders, TBody>(this.#body, {
			status: this.#status,
			statusText: this.#statusText,
			description: this.#description,
			headers: Object.fromEntries(this.#headers) as never as THeaders,
		});
	}

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
