// deno-lint-ignore-file ban-types no-explicit-any
import type { App, PublicAppRegistry } from "@baseless/server";
import type { AuthenticationApplication } from "@baseless/server/applications/authentication";
import type { DocumentApplication } from "@baseless/server/applications/document";
import type { PubsubApplication } from "@baseless/server/applications/pubsub";
import type { Reference } from "@baseless/core/ref";
import type { Request } from "@baseless/core/request";
import { Response } from "@baseless/core/response";
import type { Prettify } from "@baseless/core/prettify";
import { Credentials, MemoryCredentialsStore } from "./credentials.ts";
import {
	Document,
	DocumentAtomicCheck,
	DocumentAtomicOperation,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
} from "@baseless/core/document";
import { AuthenticationStep } from "@baseless/core/authentication-step";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
import * as z from "@baseless/core/schema";
import { fromServerErrorData, ServerErrorData } from "@baseless/core/errors";
import { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { encodeBase64Url } from "@std/encoding/base64url";
import { EventEmitter } from "./event_emitter.ts";
import { AuthenticationCeremonyInvalidPromptError, AuthenticationCeremonyInvalidStateError } from "./errors.ts";

const INTERNAL_WEBSOCKET = Symbol();
const INTERNAL_WEBSOCKET_STATE = Symbol();
const INTERNAL_TOPIC_SUBSCRIPTIONS = Symbol();
const INTERNAL_TOPIC_EMITTER = Symbol();

export interface ClientOptions {
	baseUrl: URL;
	credentials?: Credentials;
	fetch?: (input: string | globalThis.URL | globalThis.RequestInfo, init?: globalThis.RequestInit) => Promise<globalThis.Response>;
}

export class Client implements AsyncDisposable {
	#baseUrl: URL;
	#credentials: Credentials;
	#janitor: AsyncDisposableStack;
	#fetch: (input: string | globalThis.URL | globalThis.RequestInfo, init?: globalThis.RequestInit) => Promise<globalThis.Response>;
	#refreshTokensIfNeededPromise: Promise<void> | null = null;
	[INTERNAL_WEBSOCKET]: Promise<WebSocket> | null = null;
	[INTERNAL_WEBSOCKET_STATE]: "connecting" | "open" | "closing" | "closed";
	[INTERNAL_TOPIC_SUBSCRIPTIONS]: Set<string>;

	[INTERNAL_TOPIC_EMITTER]: EventEmitter<{ [key: string]: unknown }>;

	constructor(options: ClientOptions) {
		this.#baseUrl = options.baseUrl;
		this.#credentials = options.credentials ?? new Credentials(new MemoryCredentialsStore());
		this.#janitor = new AsyncDisposableStack();
		this.#fetch = options.fetch ?? globalThis.fetch;
		this[INTERNAL_WEBSOCKET_STATE] = "closed";
		this[INTERNAL_TOPIC_SUBSCRIPTIONS] = new Set();
		this[INTERNAL_TOPIC_EMITTER] = new EventEmitter();
		// If we own the credentials, make sure to dispose it when client is disposed
		if (!options.credentials) {
			this.#janitor.use(this.#credentials);
		}
		this.#janitor.use(this[INTERNAL_TOPIC_EMITTER]);
	}

	get credentials(): Credentials {
		return this.#credentials;
	}

	get auth(): ClientAuth {
		return new ClientAuth(this);
	}

	get document(): ClientDocument {
		return new ClientDocument(this);
	}

	get pubsub(): ClientPubsub {
		return new ClientPubsub(this);
	}

	async [Symbol.asyncDispose](): Promise<void> {
		await this.#janitor.disposeAsync();
		await this.disconnect();
	}

	asTyped<TApp extends App<any, any>>(): TypedClient<
		TApp extends App<any, infer TPublicAppRegistry> ? TPublicAppRegistry : PublicAppRegistry
	> {
		return this as never;
	}

	asUntyped(): Client {
		return this as never;
	}

	async #refreshTokensIfNeeded(signal?: AbortSignal): Promise<void> {
		this.#refreshTokensIfNeededPromise ??= new Promise((resolve, reject) => {
			const now = Date.now() / 1000 >> 0;
			const tokens = this.#credentials.tokens;
			if (tokens?.accessToken && tokens.refreshToken && tokens.accessTokenExpiration - now < 10) {
				this.#fetch(`${this.#baseUrl}core/auth/refresh-tokens`, {
					signal,
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ token: tokens.refreshToken }),
				})
					.then((nativeResponse) => Response.from(nativeResponse))
					.then((response) => {
						const errorResult = z.safeParse(ServerErrorData, response.body);
						if (errorResult.success) {
							throw fromServerErrorData(errorResult.data);
						}
						z.assert(z.object({ result: AuthenticationTokens }), response.body);
						return this.#credentials.add(response.body.result);
					})
					.then(() => resolve())
					.catch(reject);
			} else {
				resolve();
			}
		});
		await this.#refreshTokensIfNeededPromise;
	}

	async fetch(path: string, init?: globalThis.RequestInit): Promise<Response> {
		await this.#refreshTokensIfNeeded(init?.signal ?? undefined);
		const tokens = this.#credentials.tokens;
		const nativeResponse = await this.#fetch(
			new globalThis.Request(`${this.#baseUrl}${path}`, {
				...init,
				headers: {
					...init?.headers,
					...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
				},
			}),
		);
		const response = await Response.from(nativeResponse);
		const errorResult = z.safeParse(ServerErrorData, response.body);
		if (errorResult.success) {
			throw fromServerErrorData(errorResult.data);
		}
		return response;
	}

	async connect(baseUrl?: URL): Promise<void> {
		this[INTERNAL_WEBSOCKET] ??= this.#refreshTokensIfNeeded()
			.then(() => {
				this[INTERNAL_WEBSOCKET_STATE] = "connecting";
				const url = baseUrl ?? new URL(this.#baseUrl);
				url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
				const tokens = this.#credentials.tokens;
				const protocols: string[] = ["bls"];
				if (tokens?.accessToken) {
					protocols.push(`base64url.bearer.authorization.baseless.dev.${encodeBase64Url(tokens.accessToken)}`);
				}
				const ready = Promise.withResolvers<WebSocket>();
				const readyAbortController = new AbortController();
				const messageAbortController = new AbortController();
				const socket = new WebSocket(url, protocols);
				socket.addEventListener("open", () => {
					this[INTERNAL_WEBSOCKET_STATE] = "open";
					ready.resolve(socket);
					readyAbortController.abort();
					for (const key of this[INTERNAL_TOPIC_SUBSCRIPTIONS]) {
						socket.send(JSON.stringify({ type: "subscribe", key }));
					}
				}, { once: true, signal: readyAbortController.signal });
				socket.addEventListener("close", (event) => {
					ready.reject(event);
					readyAbortController.abort();
					messageAbortController.abort();
				}, { once: true, signal: readyAbortController.signal });
				socket.addEventListener("close", () => {
					messageAbortController.abort();
					this[INTERNAL_WEBSOCKET] = null;
					if (this[INTERNAL_WEBSOCKET_STATE] === "open") {
						this.connect();
					}
					this[INTERNAL_WEBSOCKET_STATE] = "closed";
				}, { signal: messageAbortController.signal });
				socket.addEventListener("message", (e) => {
					const data = e.data;
					const event = JSON.parse(data.toString());
					z.assert(z.object({ key: z.string(), payload: z.unknown() }), event);
					this[INTERNAL_TOPIC_EMITTER].emit(event.key, event.payload);
				}, { signal: messageAbortController.signal });
				return ready.promise;
			});
		await this[INTERNAL_WEBSOCKET];
	}

	async disconnect(): Promise<void> {
		const socket = await this[INTERNAL_WEBSOCKET];
		if (socket) {
			this[INTERNAL_WEBSOCKET_STATE] = "closing";
			socket.close();
		} else {
			this[INTERNAL_WEBSOCKET_STATE] = "closed";
		}
		this[INTERNAL_WEBSOCKET] = null;
		this[INTERNAL_TOPIC_SUBSCRIPTIONS].clear();
		this[INTERNAL_TOPIC_EMITTER].clear();
	}
}

export class ClientAuth {
	#client: Client;

	constructor(client: Client) {
		this.#client = client;
	}

	begin(
		kind: "authentication" | "registration",
		options?: { scopes?: string[]; signal?: AbortSignal; store?: ClientAuthCeremonyStore },
	): Promise<ClientAuthCeremony> {
		return ClientAuthCeremony.init(this.#client, kind, options);
	}

	async signOut(signal?: AbortSignal): Promise<void> {
		const identityId = this.#client.credentials.tokens?.identity.id;
		if (identityId) {
			const _response = await this.#client.fetch(`core/auth/sign-out`, {
				signal,
				method: "POST",
			});
			this.#client.credentials.remove(identityId);
		}
		return;
	}
}

export interface ClientAuthCeremonyStore {
	set: (steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection>) => void | Promise<void>;
	get: () =>
		| Array<AuthenticationStep | AuthenticationComponentChoiceSelection>
		| null
		| Promise<Array<AuthenticationStep | AuthenticationComponentChoiceSelection> | null>;
	delete: () => void | Promise<void>;
}

export interface AuthenticationComponentChoiceSelection {
	selected: string;
}

export class ClientAuthCeremony implements Disposable {
	#client: Client;
	#kind: "authentication" | "registration";
	#scopes?: string[];
	#steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection>;
	#store?: ClientAuthCeremonyStore;
	#expirationTimer?: number;
	#emitter: EventEmitter<{ step: AuthenticationStep | null }>;

	static async init(
		client: Client,
		kind: "authentication" | "registration",
		options?: { scopes?: string[]; signal?: AbortSignal; store?: ClientAuthCeremonyStore },
	): Promise<ClientAuthCeremony> {
		let steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection> | null = await options?.store?.get() ?? null;
		if (!steps) {
			const response = await client.fetch(`core/auth/begin`, {
				signal: options?.signal,
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ kind, scopes: options?.scopes }),
			});
			z.assert(z.object({ result: AuthenticationStep }), response.body);
			steps = [response.body.result];
		}
		return new ClientAuthCeremony(client, kind, options?.scopes ?? [], steps, options?.store);
	}

	constructor(
		client: Client,
		kind: "authentication" | "registration",
		scopes: string[],
		steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection>,
		store?: ClientAuthCeremonyStore,
	) {
		this.#client = client;
		this.#kind = kind;
		this.#scopes = scopes;
		this.#store = store;
		this.#steps = steps;
		this.#emitter = new EventEmitter();
		this.#updateTimer();
	}

	[Symbol.dispose](): void {
		clearTimeout(this.#expirationTimer);
		this.#emitter[Symbol.dispose]();
	}

	get current(): AuthenticationStep | null {
		const current = this.#steps.at(-1) ?? null;
		if (current && "selected" in current) {
			const prev = this.#steps.at(-2);
			if (!prev || "selected" in prev || prev.step.kind !== "choice") {
				throw new Error("Invalid authentication ceremony state: selection step without previous step");
			}
			const component = prev.step.prompts.find((prompt) => prompt.id === current.selected);
			if (!component) {
				throw new Error("Invalid authentication ceremony state: selected prompt not found in previous step");
			}
			return {
				...prev,
				step: component,
			};
		}
		return current;
	}

	onChange(handler: (step: AuthenticationStep | null) => void): Disposable {
		return this.#emitter.on("step", handler);
	}

	async reset(): Promise<void> {
		const response = await this.#client.fetch(`core/auth/begin`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ kind: this.#kind, scopes: this.#scopes }),
		});
		z.assert(z.object({ result: AuthenticationStep }), response.body);
		this.#steps = [response.body.result];
		this.#updateTimer();
		await this.#updateStore();
		this.#emitter.emit("step", this.current);
	}

	async prev(): Promise<void> {
		if (this.#steps.length > 1) {
			this.#steps = this.#steps.slice(0, -1);
			this.#updateTimer();
			await this.#updateStore();
		}
		this.#emitter.emit("step", this.current);
	}

	async choose(id: string): Promise<void> {
		const current = this.current;
		if (!current) {
			throw new AuthenticationCeremonyInvalidStateError();
		}
		if (current.step.kind !== "choice") {
			throw new AuthenticationCeremonyInvalidStateError();
		}
		if (!current.step.prompts.some((prompt) => prompt.id === id)) {
			throw new AuthenticationCeremonyInvalidPromptError();
		}
		this.#steps = [...this.#steps, { selected: id }];
		this.#updateTimer();
		await this.#updateStore();
		this.#emitter.emit("step", this.current);
	}

	async #updateStore(): Promise<void> {
		if (this.#steps.length > 0) {
			await this.#store?.set(this.#steps);
		} else {
			await this.#store?.delete();
		}
	}

	#updateTimer(): void {
		clearTimeout(this.#expirationTimer);
		const step = this.current;
		if (step) {
			this.#expirationTimer = setTimeout(async () => {
				await this.reset();
			}, (step.expireAt * 1000) - Date.now());
		}
	}

	async sendPrompt(locale: string, signal?: AbortSignal): Promise<boolean> {
		const id = this.current?.step.kind === "component" ? this.current?.step.id : null;
		if (!id) {
			throw new AuthenticationCeremonyInvalidStateError();
		}
		const response = await this.#client.fetch(`core/auth/send-prompt`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ id, locale, state: this.current?.state }),
		});
		z.assert(z.object({ result: z.boolean() }), response.body);
		return response.body.result;
	}

	async submitPrompt(value: unknown, signal?: AbortSignal): Promise<AuthenticationResponse> {
		const id = this.current?.step.kind === "component" ? this.current?.step.id : null;
		if (!id) {
			throw new AuthenticationCeremonyInvalidStateError();
		}
		const response = await this.#client.fetch(`core/auth/submit-prompt`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ id, value, state: this.current?.state }),
		});
		z.assert(z.object({ result: AuthenticationResponse }), response.body);
		if ("accessToken" in response.body.result) {
			await this.#client.credentials.add(response.body.result);
			this.#steps = [];
			this.#updateTimer();
			await this.#updateStore();
		} else {
			this.#steps = [...this.#steps, response.body.result];
			this.#updateTimer();
			await this.#updateStore();
		}
		this.#emitter.emit("step", this.current);
		return response.body.result;
	}

	async sendValidationCode(locale: string, signal?: AbortSignal): Promise<boolean> {
		const id = this.current?.step.kind === "component" ? this.current?.step.id : null;
		if (!id) {
			throw new AuthenticationCeremonyInvalidStateError();
		}
		const response = await this.#client.fetch(`core/auth/send-validation-code`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ id, locale, state: this.current?.state }),
		});
		z.assert(z.object({ result: z.boolean() }), response.body);
		return response.body.result;
	}

	async submitValidationCode(code: unknown, signal?: AbortSignal): Promise<AuthenticationResponse> {
		const id = this.current?.step.kind === "component" ? this.current?.step.id : null;
		if (!id) {
			throw new AuthenticationCeremonyInvalidStateError();
		}
		const response = await this.#client.fetch(`core/auth/submit-validation-code`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ id, code, state: this.current?.state }),
		});
		z.assert(z.object({ result: AuthenticationResponse }), response.body);
		if ("accessToken" in response.body.result) {
			await this.#client.credentials.add(response.body.result);
			this.#steps = [];
			this.#updateTimer();
			await this.#updateStore();
		} else {
			this.#steps = [...this.#steps, response.body.result];
			this.#updateTimer();
			await this.#updateStore();
		}
		this.#emitter.emit("step", this.current);
		return response.body.result;
	}
}

export class ClientDocument {
	#client: Client;

	constructor(client: Client) {
		this.#client = client;
	}

	async get(path: string, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Document<unknown>> {
		const response = await this.#client.fetch(`core/document/get`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ path, options }),
		});
		z.assert(z.object({ document: Document() }), response.body);
		return response.body.document;
	}

	async getMany(paths: Array<string>, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Array<Document<unknown>>> {
		const response = await this.#client.fetch(`core/document/get-many`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ paths, options }),
		});
		z.assert(z.object({ documents: z.array(Document()) }), response.body);
		return response.body.documents;
	}

	list(options: DocumentListOptions, signal?: AbortSignal): ReadableStream<DocumentListEntry<unknown>> {
		const abortController = new AbortController();
		signal?.addEventListener("abort", () => abortController.abort(), { once: true });
		return new ReadableStream<DocumentListEntry>({
			start: async (controller): Promise<void> => {
				const response = await this.#client.fetch(`core/document/list`, {
					signal,
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ options }),
				});
				z.assert(z.object({ documents: z.array(DocumentListEntry()) }), response.body);
				for (const result of response.body.documents) {
					controller.enqueue(result);
				}
				controller.close();
			},
			cancel: () => {
				abortController.abort();
			},
		});
	}

	atomic(): ClientDocumentAtomic {
		return new ClientDocumentAtomic(this.#client);
	}
}

export class ClientDocumentAtomic {
	#client: Client;
	#checks: DocumentAtomicCheck[] = [];
	#operations: DocumentAtomicOperation[] = [];

	constructor(client: Client) {
		this.#client = client;
	}

	check(path: string, versionstamp: string | null): ClientDocumentAtomic {
		this.#checks.push({ type: "check", key: path, versionstamp });
		return this;
	}

	set(path: string, value: unknown): ClientDocumentAtomic {
		this.#operations.push({ type: "set", key: path, data: value });
		return this;
	}

	delete(path: string): ClientDocumentAtomic {
		this.#operations.push({ type: "delete", key: path });
		return this;
	}

	async commit(signal?: AbortSignal): Promise<void> {
		const response = await this.#client.fetch(`core/document/commit`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				atomic: {
					checks: this.#checks,
					operations: this.#operations,
				},
			}),
		});
		z.assert(z.object({ result: z.boolean() }), response.body);
		return;
	}
}

export class ClientPubsub {
	#client: Client;

	constructor(client: Client) {
		this.#client = client;
	}

	async publish(key: string, payload: unknown, signal?: AbortSignal): Promise<void> {
		const response = await this.#client.fetch(`core/pubsub/publish`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ key, payload }),
		});
		z.assert(z.object({ sent: z.boolean() }), response.body);
		return;
	}

	subscribe(key: string, signal?: AbortSignal): ReadableStream<unknown> {
		let listener: Disposable;
		let socket: WebSocket;
		const stream = new ReadableStream<unknown>({
			start: async (controller): Promise<void> => {
				await this.#client.connect();
				socket = await this.#client[INTERNAL_WEBSOCKET]!;
				if (!this.#client[INTERNAL_TOPIC_SUBSCRIPTIONS].has(key)) {
					this.#client[INTERNAL_TOPIC_SUBSCRIPTIONS].add(key);
					socket.send(JSON.stringify({ type: "subscribe", key }));
				}
				listener = this.#client[INTERNAL_TOPIC_EMITTER].on(key, (arg) => controller.enqueue(arg));
			},
			cancel: () => {
				listener?.[Symbol.dispose]();
				if (!this.#client[INTERNAL_TOPIC_EMITTER].hasListener(key)) {
					this.#client[INTERNAL_TOPIC_SUBSCRIPTIONS].delete(key);
					socket?.send(JSON.stringify({ type: "unsubscribe", key }));
				}
			},
		});
		signal?.addEventListener("abort", () => stream.cancel(), { once: true });
		return stream;
	}
}

export interface TypedClient<TPublicAppRegistry extends PublicAppRegistry> extends AsyncDisposable {
	credentials: Credentials;

	asUntyped(): Client;

	/**
	 * Fetch an endpoint using GET method
	 */
	fetch<TPath extends keyof RemoveBuiltinEndpoints<TPublicAppRegistry["endpoints"]>>(
		// @ts-expect-error: request parameter is expected
		// deno-fmt-ignore
		path: MinimalRequestInitFromRequest<TPublicAppRegistry["endpoints"][TPath]["request"]> extends Record<PropertyKey, never> ? Reference<TPath> : never,
		init?: Prettify<
			// @ts-expect-error: request parameter is expected
			& RequestInitFromRequest<TPublicAppRegistry["endpoints"][TPath]["request"]>
			& Omit<globalThis.RequestInit, "method" | "body">
		>,
		// @ts-expect-error: response parameter is expected
	): Promise<TPublicAppRegistry["endpoints"][TPath]["response"]>;
	/**
	 * Fetch an endpoint
	 */
	fetch<TPath extends keyof RemoveBuiltinEndpoints<TPublicAppRegistry["endpoints"]>>(
		path: Reference<TPath>,
		init: Prettify<
			// @ts-expect-error: request parameter is expected
			& RequestInitFromRequest<TPublicAppRegistry["endpoints"][TPath]["request"]>
			& Omit<globalThis.RequestInit, "headers" | "method" | "body">
		>,
		// @ts-expect-error: response parameter is expected
	): Promise<TPublicAppRegistry["endpoints"][TPath]["response"]>;

	connect(baseUrl?: URL): Promise<void>;

	auth: ClientAuth;
	document: TypedClientDocument<TPublicAppRegistry["collections"], TPublicAppRegistry["documents"]>;
	pubsub: TypedClientPubsub<TPublicAppRegistry["topics"]>;
}

export interface TypedClientDocument<
	TCollections extends PublicAppRegistry["collections"],
	TDocuments extends PublicAppRegistry["documents"],
> {
	get<TPath extends keyof TDocuments>(
		ref: Reference<TPath>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Document<TDocuments[TPath]>>;
	getMany<TPath extends keyof TDocuments>(
		refs: Array<Reference<TPath>>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Array<Document<TDocuments[TPath]>>>;
	list<TPath extends keyof TCollections>(
		options: DocumentListOptions<Reference<TPath>>,
		signal?: AbortSignal,
	): ReadableStream<DocumentListEntry<TCollections[TPath]>>;
	atomic(): TypedClientDocumentAtomic<TCollections, TDocuments>;
}

export interface TypedClientDocumentAtomic<
	TCollections extends PublicAppRegistry["collections"],
	TDocuments extends PublicAppRegistry["documents"],
> {
	check<TPath extends keyof TDocuments>(
		ref: Reference<TPath>,
		versionstamp: string | null,
	): TypedClientDocumentAtomic<TCollections, TDocuments>;
	set<TPath extends keyof TDocuments>(ref: Reference<TPath>, value: TDocuments[TPath]): TypedClientDocumentAtomic<TCollections, TDocuments>;
	delete<TPath extends keyof TDocuments>(ref: Reference<TPath>): TypedClientDocumentAtomic<TCollections, TDocuments>;
	commit(signal?: AbortSignal): Promise<void>;
}

export interface TypedClientPubsub<
	TTopics extends PublicAppRegistry["topics"],
> {
	publish<TPath extends keyof TTopics>(ref: Reference<TPath>, payload: TTopics[TPath], signal?: AbortSignal): Promise<void>;
	subscribe<TPath extends keyof TTopics>(ref: Reference<TPath>, abortSignal?: AbortSignal): ReadableStream<TTopics[TPath]>;
}

// deno-fmt-ignore
type RequestInitFromRequest<T> = T extends Request<infer TMethod, infer THeaders, any, infer TBody>
	? Prettify<(
		(TMethod extends "GET" ? { method?: "GET" } : { method: TMethod; }) &
		(THeaders extends Record<PropertyKey, never> ? { headers?: Record<string, string> } : { headers: THeaders; }) &
		(TBody extends null ? {} : { body: TBody; })
	)>
	: {};

// deno-fmt-ignore
type MinimalRequestInitFromRequest<T> = T extends Request<infer TMethod, infer THeaders, any, infer TBody>
	? Prettify<(
		(TMethod extends "GET" ? {} : { method: TMethod; }) &
		(THeaders extends Record<PropertyKey, never> ? {} : { headers: THeaders; }) &
		(TBody extends null ? {} : { body: TBody; })
	)>
	: {};

type ApplicationEndpoints<T> = T extends App<any, infer TRegistry> ? TRegistry["endpoints"] : never;

type BuiltinEndpointPaths =
	| keyof ApplicationEndpoints<AuthenticationApplication>
	| keyof ApplicationEndpoints<DocumentApplication>
	| keyof ApplicationEndpoints<PubsubApplication>;

type RemoveBuiltinEndpoints<TEndpoints> = Omit<TEndpoints, BuiltinEndpointPaths>;
