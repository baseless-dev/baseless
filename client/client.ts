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

/**
 * Construction options for {@link Client}.
 */
export interface ClientOptions {
	baseUrl: URL;
	credentials?: Credentials;
	fetch?: (input: string | globalThis.URL | globalThis.RequestInfo, init?: globalThis.RequestInit) => Promise<globalThis.Response>;
}

/**
 * Main Baseless client. Handles HTTP requests, WebSocket connections, token
 * refresh, and exposes {@link auth}, {@link document}, and {@link pubsub}
 * sub-clients.
 *
 * @example
 * ```ts
 * import { Client } from "@baseless/client";
 *
 * const client = new Client({ baseUrl: new URL("http://localhost:8000/") });
 * await client.auth.begin("authentication");
 * ```
 */
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

	/** The {@link Credentials} store used by this client. */
	get credentials(): Credentials {
		return this.#credentials;
	}

	/** Returns a {@link ClientAuth} sub-client for authentication operations. */
	get auth(): ClientAuth {
		return new ClientAuth(this);
	}

	/** Returns a {@link ClientDocument} sub-client for document store operations. */
	get document(): ClientDocument {
		return new ClientDocument(this);
	}

	/** Returns a {@link ClientPubsub} sub-client for publish/subscribe operations. */
	get pubsub(): ClientPubsub {
		return new ClientPubsub(this);
	}

	async [Symbol.asyncDispose](): Promise<void> {
		await this.#janitor.disposeAsync();
		await this.disconnect();
	}

	/**
	 * Casts the client to a strongly-typed wrapper inferred from the given
	 * {@link App} type parameter.
	 */
	asTyped<TApp extends App<any, any>>(): TypedClient<
		TApp extends App<any, infer TPublicAppRegistry> ? TPublicAppRegistry : PublicAppRegistry
	> {
		return this as never;
	}

	/** Returns the client without the typed wrapper. */
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

	/**
	 * Makes an authenticated HTTP request to the server and returns the parsed
	 * {@link Response}. Throws if the server returns an error payload.
	 * @param path The server path (relative to `baseUrl`).
	 * @param init Optional native `RequestInit` options.
	 * @returns The server response.
	 */
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

	/**
	 * Opens a WebSocket connection to the server (or reuses an existing one).
	 * Automatically re-subscribes to any active topics after reconnecting.
	 * @param baseUrl Optional override for the WebSocket URL.
	 */
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

	/**
	 * Closes the active WebSocket connection and clears all topic subscriptions.
	 */
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

/**
 * Sub-client for authentication operations (begin ceremony, sign out).
 * Obtain an instance via {@link Client.auth}.
 */
export class ClientAuth {
	#client: Client;

	constructor(client: Client) {
		this.#client = client;
	}

	/**
	 * Starts a new authentication or registration ceremony.
	 * @param kind Whether to start an `"authentication"` or `"registration"` flow.
	 * @param options Optional scopes, abort signal, and local ceremony store.
	 * @returns A {@link ClientAuthCeremony} to drive the multi-step flow.
	 */
	begin(
		kind: "authentication" | "registration",
		options?: { scopes?: string[]; signal?: AbortSignal; store?: ClientAuthCeremonyStore },
	): Promise<ClientAuthCeremony> {
		return ClientAuthCeremony.init(this.#client, kind, options);
	}

	/**
	 * Signs the current user out by invalidating their session on the server and
	 * removing stored credentials.
	 * @param signal Optional abort signal.
	 */
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

/**
 * Optional persistence interface supplied to {@link ClientAuthCeremony} so
 * that ceremony progress survives page reloads.
 */
export interface ClientAuthCeremonyStore {
	set: (steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection>) => void | Promise<void>;
	get: () =>
		| Array<AuthenticationStep | AuthenticationComponentChoiceSelection>
		| null
		| Promise<Array<AuthenticationStep | AuthenticationComponentChoiceSelection> | null>;
	delete: () => void | Promise<void>;
}

/**
 * Represents a user's choice when the ceremony presents a choice step.
 */
export interface AuthenticationComponentChoiceSelection {
	selected: string;
}

/**
 * Drives a multi-step authentication or registration ceremony.
 * Obtain an instance via {@link ClientAuth.begin}.
 */
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

	/** The current {@link AuthenticationStep}, or `null` when the ceremony is complete. */
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

	/**
	 * Registers a callback invoked whenever the current step changes.
	 * @param handler Called with the new step (or `null` when finished).
	 * @returns A {@link Disposable} that removes the listener when disposed.
	 */
	onChange(handler: (step: AuthenticationStep | null) => void): Disposable {
		return this.#emitter.on("step", handler);
	}

	/**
	 * Resets the ceremony back to the first step by requesting a fresh one from
	 * the server.
	 */
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

	/**
	 * Goes back to the previous step.
	 * Does nothing if already at the first step.
	 */
	async prev(): Promise<void> {
		if (this.#steps.length > 1) {
			this.#steps = this.#steps.slice(0, -1);
			this.#updateTimer();
			await this.#updateStore();
		}
		this.#emitter.emit("step", this.current);
	}

	/**
	 * Selects a component by `id` when the current step is a choice step.
	 * @param id The component ID to pick.
	 * @throws {@link AuthenticationCeremonyInvalidStateError} if not at a choice step.
	 * @throws {@link AuthenticationCeremonyInvalidPromptError} if `id` is not a valid option.
	 */
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

	/**
	 * Asks the server to send a prompt (e.g. an OTP code) to the user's channel.
	 * @param locale BCP 47 locale string for the message.
	 * @param signal Optional abort signal.
	 * @returns `true` if the prompt was sent successfully.
	 */
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

	/**
	 * Submits the user's answer for the current prompt step.
	 * @param value The prompt value to submit.
	 * @param signal Optional abort signal.
	 * @returns The next {@link AuthenticationResponse} (another step or tokens).
	 */
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

	/**
	 * Asks the server to send a validation code (e.g. for email/phone OTP).
	 * @param locale BCP 47 locale string for the message.
	 * @param signal Optional abort signal.
	 * @returns `true` if the code was sent successfully.
	 */
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

	/**
	 * Submits a validation code received out-of-band (e.g. via email).
	 * @param code The validation code to submit.
	 * @param signal Optional abort signal.
	 * @returns The next {@link AuthenticationResponse} (another step or tokens).
	 */
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

/**
 * Sub-client for document store operations (get, list, atomic writes).
 * Obtain an instance via {@link Client.document}.
 */
export class ClientDocument {
	#client: Client;

	constructor(client: Client) {
		this.#client = client;
	}

	/**
	 * Fetches a single document by path.
	 * @param path The document path.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns The {@link Document} at the given path.
	 */
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

	/**
	 * Fetches multiple documents in a single request.
	 * @param paths Array of document paths to retrieve.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns An array of {@link Document} values in the same order as `paths`.
	 */
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

	/**
	 * Lists documents under a path prefix, streaming results as a
	 * `ReadableStream`.
	 * @param options Listing options (prefix, cursor, limit, etc.).
	 * @param signal Optional abort signal to cancel the stream.
	 * @returns A stream of {@link DocumentListEntry} values.
	 */
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

	/**
	 * Returns a builder for atomic document operations.
	 * @returns A {@link ClientDocumentAtomic} builder.
	 */
	atomic(): ClientDocumentAtomic {
		return new ClientDocumentAtomic(this.#client);
	}
}

/**
 * Builder for atomic document operations (check-and-set / delete).
 * Obtain an instance via {@link ClientDocument.atomic}.
 */
export class ClientDocumentAtomic {
	#client: Client;
	#checks: DocumentAtomicCheck[] = [];
	#operations: DocumentAtomicOperation[] = [];

	constructor(client: Client) {
		this.#client = client;
	}

	/**
	 * Adds a version-stamp pre-condition to the atomic operation.
	 * @param path The document path.
	 * @param versionstamp The expected versionstamp, or `null` to check absence.
	 * @returns `this` for chaining.
	 */
	check(path: string, versionstamp: string | null): ClientDocumentAtomic {
		this.#checks.push({ type: "check", key: path, versionstamp });
		return this;
	}

	/**
	 * Adds a set operation to the atomic batch.
	 * @param path The document path.
	 * @param value The value to write.
	 * @returns `this` for chaining.
	 */
	set(path: string, value: unknown): ClientDocumentAtomic {
		this.#operations.push({ type: "set", key: path, data: value });
		return this;
	}

	/**
	 * Adds a delete operation to the atomic batch.
	 * @param path The document path to delete.
	 * @returns `this` for chaining.
	 */
	delete(path: string): ClientDocumentAtomic {
		this.#operations.push({ type: "delete", key: path });
		return this;
	}

	/**
	 * Commits the atomic batch to the server.
	 * @param signal Optional abort signal.
	 */
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

/**
 * Sub-client for publish/subscribe operations.
 * Obtain an instance via {@link Client.pubsub}.
 */
export class ClientPubsub {
	#client: Client;

	constructor(client: Client) {
		this.#client = client;
	}

	/**
	 * Publishes a `payload` to all subscribers of `key`.
	 * @param key The topic key.
	 * @param payload The payload to broadcast.
	 * @param signal Optional abort signal.
	 */
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

	/**
	 * Returns a `ReadableStream` that emits payloads published to `key`.
	 * Opens a WebSocket connection if one is not already active.
	 * The stream unsubscribes automatically when cancelled.
	 * @param key The topic key to subscribe to.
	 * @param signal Optional abort signal to cancel the stream.
	 * @returns A stream of incoming payloads.
	 */
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

/**
 * Strongly-typed wrapper around {@link Client} inferred from an
 * {@link App} definition. Obtain via {@link Client.asTyped}.
 *
 * @template TPublicAppRegistry The registry exported by the server app.
 */
export interface TypedClient<TPublicAppRegistry extends PublicAppRegistry> extends AsyncDisposable {
	/** The {@link Credentials} store used by this client. */
	credentials: Credentials;

	/** Returns the client without the typed wrapper. */
	asUntyped(): Client;

	/**
	 * Makes an authenticated HTTP request to a typed endpoint using the GET
	 * method. The `init` argument may be omitted when the endpoint requires no
	 * custom headers or body.
	 * @param path Reference to the endpoint path.
	 * @param init Optional request options (headers, signal, etc.).
	 * @returns The typed response produced by the endpoint.
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
	 * Makes an authenticated HTTP request to a typed endpoint. Automatically
	 * attaches the bearer token and throws if the server returns an error payload.
	 * @param path Reference to the endpoint path.
	 * @param init Request options including method, headers, and body as required
	 *   by the endpoint's request type.
	 * @returns The typed response produced by the endpoint.
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

	/**
	 * Opens a WebSocket connection to the server (or reuses an existing one).
	 * Automatically re-subscribes to any active topics after reconnecting.
	 * @param baseUrl Optional override for the WebSocket URL.
	 */
	connect(baseUrl?: URL): Promise<void>;

	/** Sub-client for authentication operations. */
	auth: ClientAuth;
	/** Typed document sub-client. */
	document: TypedClientDocument<TPublicAppRegistry["collections"], TPublicAppRegistry["documents"]>;
	/** Typed pubsub sub-client. */
	pubsub: TypedClientPubsub<TPublicAppRegistry["topics"]>;
}

/**
 * Typed document sub-client inferred from an {@link App} registry.
 *
 * @template TCollections Map of collection paths to their document types.
 * @template TDocuments Map of document paths to their value types.
 */
export interface TypedClientDocument<
	TCollections extends PublicAppRegistry["collections"],
	TDocuments extends PublicAppRegistry["documents"],
> {
	/**
	 * Fetches a single document by path.
	 * @param ref Reference to the document path.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns The {@link Document} at the given path.
	 */
	get<TPath extends keyof TDocuments>(
		ref: Reference<TPath>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Document<TDocuments[TPath]>>;
	/**
	 * Fetches multiple documents in a single request.
	 * @param refs Array of document path references to retrieve.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns An array of {@link Document} values in the same order as `refs`.
	 */
	getMany<TPath extends keyof TDocuments>(
		refs: Array<Reference<TPath>>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Array<Document<TDocuments[TPath]>>>;
	/**
	 * Lists documents under a path prefix, streaming results as a
	 * `ReadableStream`.
	 * @param options Listing options (prefix, cursor, limit, etc.).
	 * @param signal Optional abort signal to cancel the stream.
	 * @returns A stream of {@link DocumentListEntry} values.
	 */
	list<TPath extends keyof TCollections>(
		options: DocumentListOptions<Reference<TPath>>,
		signal?: AbortSignal,
	): ReadableStream<DocumentListEntry<TCollections[TPath]>>;
	/**
	 * Returns a builder for atomic document operations.
	 * @returns A {@link TypedClientDocumentAtomic} builder.
	 */
	atomic(): TypedClientDocumentAtomic<TCollections, TDocuments>;
}

/**
 * Typed atomic document operation builder inferred from an {@link App} registry.
 *
 * @template TCollections Map of collection paths to their document types.
 * @template TDocuments Map of document paths to their value types.
 */
export interface TypedClientDocumentAtomic<
	TCollections extends PublicAppRegistry["collections"],
	TDocuments extends PublicAppRegistry["documents"],
> {
	/**
	 * Adds a version-stamp pre-condition to the atomic operation.
	 * @param ref Reference to the document path.
	 * @param versionstamp The expected versionstamp, or `null` to check absence.
	 * @returns `this` for chaining.
	 */
	check<TPath extends keyof TDocuments>(
		ref: Reference<TPath>,
		versionstamp: string | null,
	): TypedClientDocumentAtomic<TCollections, TDocuments>;
	/**
	 * Adds a set operation to the atomic batch.
	 * @param ref Reference to the document path.
	 * @param value The value to write.
	 * @returns `this` for chaining.
	 */
	set<TPath extends keyof TDocuments>(ref: Reference<TPath>, value: TDocuments[TPath]): TypedClientDocumentAtomic<TCollections, TDocuments>;
	/**
	 * Adds a delete operation to the atomic batch.
	 * @param ref Reference to the document path to delete.
	 * @returns `this` for chaining.
	 */
	delete<TPath extends keyof TDocuments>(ref: Reference<TPath>): TypedClientDocumentAtomic<TCollections, TDocuments>;
	/**
	 * Commits the atomic batch to the server.
	 * @param signal Optional abort signal.
	 */
	commit(signal?: AbortSignal): Promise<void>;
}

/**
 * Typed pubsub sub-client inferred from an {@link App} registry.
 *
 * @template TTopics Map of topic paths to their payload types.
 */
export interface TypedClientPubsub<
	TTopics extends PublicAppRegistry["topics"],
> {
	/**
	 * Publishes a `payload` to all subscribers of `ref`.
	 * @param ref Reference to the topic key.
	 * @param payload The payload to broadcast.
	 * @param signal Optional abort signal.
	 */
	publish<TPath extends keyof TTopics>(ref: Reference<TPath>, payload: TTopics[TPath], signal?: AbortSignal): Promise<void>;
	/**
	 * Returns a `ReadableStream` that emits payloads published to `ref`.
	 * Opens a WebSocket connection if one is not already active.
	 * The stream unsubscribes automatically when cancelled.
	 * @param ref Reference to the topic key to subscribe to.
	 * @param abortSignal Optional abort signal to cancel the stream.
	 * @returns A stream of incoming payloads.
	 */
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
