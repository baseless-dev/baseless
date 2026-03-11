// deno-lint-ignore-file ban-types no-explicit-any
import type { App, PublicAppRegistry } from "@baseless/server";
import type { AuthenticationApplication } from "@baseless/server/apps/authentication";
import type { DocumentApplication } from "@baseless/server/apps/document";
import type { PubsubApplication } from "@baseless/server/apps/pubsub";
import type { StorageApplication } from "@baseless/server/apps/storage";
import type { TableApplication } from "@baseless/server/apps/table";
import type { PathToParams } from "@baseless/core/path";
import { resolvePath } from "@baseless/core/path";
import type { Request } from "@baseless/core/request";
import { Response } from "@baseless/core/response";
import type { Prettify } from "@baseless/core/prettify";
import { Credentials, MemoryCredentialsStore } from "./credentials.ts";
import { Document, DocumentAtomicCheck, DocumentAtomicOperation, DocumentGetOptions, DocumentListEntry } from "@baseless/core/document";
import { AuthenticationStep } from "@baseless/core/authentication-step";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
import * as z from "@baseless/core/schema";
import { fromServerErrorData, ServerErrorData } from "@baseless/core/errors";
import { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { encodeBase64Url } from "@std/encoding/base64url";
import { EventEmitter } from "./event_emitter.ts";
import { AuthenticationCeremonyInvalidPromptError, AuthenticationCeremonyInvalidStateError } from "./errors.ts";
import { BatchableStatementBuilder, type IStatementBuilder, type TStatement } from "@baseless/core/query";
import {
	StorageListEntry,
	StorageObject,
	type StorageSignedDownloadUrlOptions,
	type StorageSignedUploadUrlOptions,
	StorageSignedUrl,
} from "@baseless/core/storage";

const INTERNAL_WEBSOCKET = Symbol();
const INTERNAL_WEBSOCKET_STATE = Symbol();
const INTERNAL_TOPIC_SUBSCRIPTIONS = Symbol();
const INTERNAL_TOPIC_EMITTER = Symbol();

/**
 * Construction options for {@link Client}.
 */
export interface ClientOptions {
	baseUrl: URL | { base: URL; auth: string; document: string; pubsub: string; storage: string; table: string };
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
	#baseUrls: { base: URL; auth: string; document: string; pubsub: string; storage: string; table: string };
	#credentials: Credentials;
	#janitor: AsyncDisposableStack;
	#fetch: (input: string | globalThis.URL | globalThis.RequestInfo, init?: globalThis.RequestInit) => Promise<globalThis.Response>;
	#refreshTokensIfNeededPromise: Promise<void> | null = null;
	[INTERNAL_WEBSOCKET]: Promise<WebSocket> | null = null;
	[INTERNAL_WEBSOCKET_STATE]: "connecting" | "open" | "closing" | "closed";
	[INTERNAL_TOPIC_SUBSCRIPTIONS]: Set<string>;

	[INTERNAL_TOPIC_EMITTER]: EventEmitter<{ [key: string]: unknown }>;

	constructor(options: ClientOptions) {
		this.#baseUrls = options.baseUrl instanceof URL
			? { base: options.baseUrl, auth: "auth", document: "document", pubsub: "pubsub", storage: "storage", table: "table" }
			: options.baseUrl;
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
		return new ClientAuth(this, this.#baseUrls.auth);
	}

	/** Returns a {@link ClientDocument} sub-client for document store operations. */
	get document(): ClientDocument {
		return new ClientDocument(this, this.#baseUrls.document);
	}

	/** Returns a {@link ClientPubsub} sub-client for publish/subscribe operations. */
	get pubsub(): ClientPubsub {
		return new ClientPubsub(this, this.#baseUrls.pubsub);
	}

	/** Returns a {@link ClientTable} sub-client for table query operations. */
	get table(): ClientTable {
		return new ClientTable(this, this.#baseUrls.table);
	}

	/** Returns a {@link ClientStorage} sub-client for storage operations. */
	get storage(): ClientStorage {
		return new ClientStorage(this, this.#baseUrls.storage);
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
				this.#fetch(`${this.#baseUrls}core/auth/refresh-tokens`, {
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
			new globalThis.Request(`${this.#baseUrls.base}${path}`, {
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
				const url = baseUrl ?? new URL(this.#baseUrls.base);
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
	#endpoint: string;

	constructor(client: Client, endpoint: string) {
		this.#client = client;
		this.#endpoint = endpoint;
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
		return ClientAuthCeremony.init(this.#client, this.#endpoint, kind, options);
	}

	/**
	 * Signs the current user out by invalidating their session on the server and
	 * removing stored credentials.
	 * @param signal Optional abort signal.
	 */
	async signOut(signal?: AbortSignal): Promise<void> {
		const identityId = this.#client.credentials.tokens?.identity.id;
		if (identityId) {
			const _response = await this.#client.fetch(`${this.#endpoint}/sign-out`, {
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
	#endpoint: string;
	#kind: "authentication" | "registration";
	#scopes?: string[];
	#steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection>;
	#store?: ClientAuthCeremonyStore;
	#expirationTimer?: number;
	#emitter: EventEmitter<{ step: AuthenticationStep | null }>;

	static async init(
		client: Client,
		endpoint: string,
		kind: "authentication" | "registration",
		options?: { scopes?: string[]; signal?: AbortSignal; store?: ClientAuthCeremonyStore },
	): Promise<ClientAuthCeremony> {
		let steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection> | null = await options?.store?.get() ?? null;
		if (!steps) {
			const response = await client.fetch(`${endpoint}/begin`, {
				signal: options?.signal,
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ kind, scopes: options?.scopes }),
			});
			z.assert(z.object({ result: AuthenticationStep }), response.body);
			steps = [response.body.result];
		}
		return new ClientAuthCeremony(client, endpoint, kind, options?.scopes ?? [], steps, options?.store);
	}

	constructor(
		client: Client,
		endpoint: string,
		kind: "authentication" | "registration",
		scopes: string[],
		steps: Array<AuthenticationStep | AuthenticationComponentChoiceSelection>,
		store?: ClientAuthCeremonyStore,
	) {
		this.#client = client;
		this.#endpoint = endpoint;
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
		const response = await this.#client.fetch(`${this.#endpoint}/begin`, {
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
		const response = await this.#client.fetch(`${this.#endpoint}/send-prompt`, {
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
		const response = await this.#client.fetch(`${this.#endpoint}/submit-prompt`, {
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
		const response = await this.#client.fetch(`${this.#endpoint}/send-validation-code`, {
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
		const response = await this.#client.fetch(`${this.#endpoint}/submit-validation-code`, {
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
	#endpoint: string;

	constructor(client: Client, endpoint: string) {
		this.#client = client;
		this.#endpoint = endpoint;
	}

	/**
	 * Fetches a single document by path.
	 * @param path The document path template.
	 * @param params Path parameters to resolve.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns The {@link Document} at the given path.
	 */
	async get(path: string, params: Record<string, unknown>, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Document<unknown>> {
		const response = await this.#client.fetch(`${this.#endpoint}/get`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ path: resolvePath(path, params as never), options }),
		});
		z.assert(z.object({ document: Document() }), response.body);
		return response.body.document;
	}

	/**
	 * Fetches multiple documents in a single request.
	 * @param keys Array of [path, params] tuples to retrieve.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns An array of {@link Document} values.
	 */
	async getMany(
		keys: Array<[string, Record<string, unknown>]>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Array<Document<unknown>>> {
		const paths = keys.map(([path, params]) => resolvePath(path, params as never));
		const response = await this.#client.fetch(`${this.#endpoint}/get-many`, {
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
	 * @param prefix The collection path template.
	 * @param params Path parameters.
	 * @param options Optional listing options (cursor, limit).
	 * @param signal Optional abort signal to cancel the stream.
	 * @returns A stream of {@link DocumentListEntry} values.
	 */
	list(
		prefix: string,
		params: Record<string, unknown>,
		options?: { cursor?: string; limit?: number },
		signal?: AbortSignal,
	): ReadableStream<DocumentListEntry<unknown>> {
		const resolvedPrefix = resolvePath(prefix, params as never);
		const abortController = new AbortController();
		signal?.addEventListener("abort", () => abortController.abort(), { once: true });
		return new ReadableStream<DocumentListEntry>({
			start: async (controller): Promise<void> => {
				const response = await this.#client.fetch(`${this.#endpoint}/list`, {
					signal,
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ options: { prefix: resolvedPrefix, cursor: options?.cursor, limit: options?.limit } }),
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
		return new ClientDocumentAtomic(this.#client, this.#endpoint);
	}
}

/**
 * Builder for atomic document operations (check-and-set / delete).
 * Obtain an instance via {@link ClientDocument.atomic}.
 */
export class ClientDocumentAtomic {
	#client: Client;
	#endpoint: string;
	#checks: DocumentAtomicCheck[] = [];
	#operations: DocumentAtomicOperation[] = [];

	constructor(client: Client, endpoint: string) {
		this.#client = client;
		this.#endpoint = endpoint;
	}

	/**
	 * Adds a version-stamp pre-condition to the atomic operation.
	 * @param path The document path template.
	 * @param params Path parameters.
	 * @param versionstamp The expected versionstamp, or `null` to check absence.
	 * @returns `this` for chaining.
	 */
	check(path: string, params: Record<string, unknown>, versionstamp: string | null): ClientDocumentAtomic {
		this.#checks.push({ type: "check", key: resolvePath(path, params as never), versionstamp });
		return this;
	}

	/**
	 * Adds a set operation to the atomic batch.
	 * @param path The document path template.
	 * @param params Path parameters.
	 * @param value The value to write.
	 * @returns `this` for chaining.
	 */
	set(path: string, params: Record<string, unknown>, value: unknown): ClientDocumentAtomic {
		this.#operations.push({ type: "set", key: resolvePath(path, params as never), data: value });
		return this;
	}

	/**
	 * Adds a delete operation to the atomic batch.
	 * @param path The document path template.
	 * @param params Path parameters.
	 * @returns `this` for chaining.
	 */
	delete(path: string, params: Record<string, unknown>): ClientDocumentAtomic {
		this.#operations.push({ type: "delete", key: resolvePath(path, params as never) });
		return this;
	}

	/**
	 * Commits the atomic batch to the server.
	 * @param signal Optional abort signal.
	 */
	async commit(signal?: AbortSignal): Promise<void> {
		const response = await this.#client.fetch(`${this.#endpoint}/commit`, {
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
	#endpoint: string;

	constructor(client: Client, endpoint: string) {
		this.#client = client;
		this.#endpoint = endpoint;
	}

	/**
	 * Publishes a `payload` to all subscribers of `key`.
	 * @param path The topic path template.
	 * @param params Path parameters.
	 * @param payload The payload to broadcast.
	 * @param signal Optional abort signal.
	 */
	async publish(path: string, params: Record<string, unknown>, payload: unknown, signal?: AbortSignal): Promise<void> {
		const key = resolvePath(path, params as never);
		const response = await this.#client.fetch(`${this.#endpoint}/publish`, {
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
	 * @param path The topic path template.
	 * @param params Path parameters.
	 * @param signal Optional abort signal to cancel the stream.
	 * @returns A stream of incoming payloads.
	 */
	subscribe(path: string, params: Record<string, unknown>, signal?: AbortSignal): ReadableStream<unknown> {
		const key = resolvePath(path, params as never);
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
 * Sub-client for table query operations.
 * Obtain an instance via {@link Client.table}.
 */
export class ClientTable {
	#client: Client;
	#endpoint: string;

	constructor(client: Client, endpoint: string) {
		this.#client = client;
		this.#endpoint = endpoint;
	}

	/**
	 * Executes a query statement against the server's registered tables.
	 * @param fn A callback receiving a {@link BatchableStatementBuilder} and returning the statement to execute.
	 * @param params A record of named parameter values to bind.
	 * @param signal Optional abort signal.
	 * @returns The query result.
	 */
	async execute<TParams extends Record<string, unknown>, TOutput>(
		fn: (q: BatchableStatementBuilder<{}, {}>) => IStatementBuilder<TParams, TOutput>,
		params: TParams,
		signal?: AbortSignal,
	): Promise<TOutput> {
		const statement = fn(new BatchableStatementBuilder()).toStatement();
		const response = await this.#client.fetch(`${this.#endpoint}/execute`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ statement, params }),
		});
		z.assert(z.object({ result: z.unknown() }), response.body);
		return response.body.result as TOutput;
	}
}

/**
 * Sub-client for storage operations (metadata, signed URLs, delete, list).
 * Obtain an instance via {@link Client.storage}.
 */
export class ClientStorage {
	#client: Client;
	#endpoint: string;

	constructor(client: Client, endpoint: string) {
		this.#client = client;
		this.#endpoint = endpoint;
	}

	/**
	 * Fetches metadata for a single storage object.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param signal Optional abort signal.
	 * @returns The {@link StorageObject} metadata.
	 */
	async getMetadata(path: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<StorageObject> {
		const response = await this.#client.fetch(`${this.#endpoint}/get-metadata`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ path: resolvePath(path, params as never) }),
		});
		z.assert(z.object({ object: StorageObject() }), response.body);
		return response.body.object;
	}

	/**
	 * Gets a signed upload URL for a file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional upload options (contentType, metadata, expirySeconds).
	 * @param signal Optional abort signal.
	 * @returns A {@link StorageSignedUrl} with the upload URL and expiry.
	 */
	async getSignedUploadUrl(
		path: string,
		params: Record<string, unknown>,
		options?: StorageSignedUploadUrlOptions,
		signal?: AbortSignal,
	): Promise<StorageSignedUrl> {
		const response = await this.#client.fetch(`${this.#endpoint}/upload-url`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ path: resolvePath(path, params as never), options }),
		});
		z.assert(z.object({ url: StorageSignedUrl() }), response.body);
		return response.body.url;
	}

	/**
	 * Gets a signed download URL for a file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional download options (expirySeconds).
	 * @param signal Optional abort signal.
	 * @returns A {@link StorageSignedUrl} with the download URL and expiry.
	 */
	async getSignedDownloadUrl(
		path: string,
		params: Record<string, unknown>,
		options?: StorageSignedDownloadUrlOptions,
		signal?: AbortSignal,
	): Promise<StorageSignedUrl> {
		const response = await this.#client.fetch(`${this.#endpoint}/download-url`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ path: resolvePath(path, params as never), options }),
		});
		z.assert(z.object({ url: StorageSignedUrl() }), response.body);
		return response.body.url;
	}

	/**
	 * Deletes a file from storage.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param signal Optional abort signal.
	 */
	async delete(path: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<void> {
		await this.#client.fetch(`${this.#endpoint}/delete`, {
			signal,
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ path: resolvePath(path, params as never) }),
		});
	}

	/**
	 * Lists files in a folder, streaming results as a `ReadableStream`.
	 * @param prefix The folder path template.
	 * @param params Path parameters.
	 * @param options Optional listing options (cursor, limit).
	 * @param signal Optional abort signal.
	 * @returns A stream of {@link StorageListEntry} values.
	 */
	list(
		prefix: string,
		params: Record<string, unknown>,
		options?: { cursor?: string; limit?: number },
		signal?: AbortSignal,
	): ReadableStream<StorageListEntry> {
		const resolvedPrefix = resolvePath(prefix, params as never);
		const abortController = new AbortController();
		signal?.addEventListener("abort", () => abortController.abort(), { once: true });
		return new ReadableStream<StorageListEntry>({
			start: async (controller): Promise<void> => {
				const response = await this.#client.fetch(`${this.#endpoint}/list`, {
					signal,
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ options: { prefix: resolvedPrefix, cursor: options?.cursor, limit: options?.limit } }),
				});
				z.assert(z.object({ entries: z.array(StorageListEntry()) }), response.body);
				for (const entry of response.body.entries) {
					controller.enqueue(entry);
				}
				controller.close();
			},
			cancel: () => {
				abortController.abort();
			},
		});
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
	fetch<TPath extends keyof TPublicAppRegistry["endpoints"] & string>(
		// @ts-expect-error: request parameter is expected
		// deno-fmt-ignore
		path: MinimalRequestInitFromRequest<TPublicAppRegistry["endpoints"][TPath]["request"]> extends Record<PropertyKey, never> ? TPath : never,
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
	 * @param path The endpoint path.
	 * @param init Request options including method, headers, and body as required
	 *   by the endpoint's request type.
	 * @returns The typed response produced by the endpoint.
	 */
	fetch<TPath extends keyof TPublicAppRegistry["endpoints"] & string>(
		path: TPath,
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
	/** Typed storage sub-client. */
	storage: TypedClientStorage<TPublicAppRegistry["files"], TPublicAppRegistry["folders"]>;
	/** Typed table sub-client. */
	table: TypedClientTable<TPublicAppRegistry["tables"]>;
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
	 * @param path The document path template.
	 * @param params Path parameters.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns The {@link Document} at the given path.
	 */
	get<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Document<TDocuments[TPath]>>;
	/**
	 * Fetches multiple documents in a single request.
	 * @param keys Array of [path, params] tuples to retrieve.
	 * @param options Optional consistency / read options.
	 * @param signal Optional abort signal.
	 * @returns An array of {@link Document} values.
	 */
	getMany<TPath extends keyof TDocuments & string>(
		keys: Array<[path: TPath, params: PathToParams<TPath>]>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Array<Document<TDocuments[TPath]>>>;
	/**
	 * Lists documents under a path prefix, streaming results as a
	 * `ReadableStream`.
	 * @param prefix The collection path template.
	 * @param params Path parameters.
	 * @param options Optional listing options (cursor, limit).
	 * @param signal Optional abort signal to cancel the stream.
	 * @returns A stream of {@link DocumentListEntry} values.
	 */
	list<TPath extends keyof TCollections & string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number },
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
	 * @param path The document path template.
	 * @param params Path parameters.
	 * @param versionstamp The expected versionstamp, or `null` to check absence.
	 * @returns `this` for chaining.
	 */
	check<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		versionstamp: string | null,
	): TypedClientDocumentAtomic<TCollections, TDocuments>;
	/**
	 * Adds a set operation to the atomic batch.
	 * @param path The document path template.
	 * @param params Path parameters.
	 * @param value The value to write.
	 * @returns `this` for chaining.
	 */
	set<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
		value: TDocuments[TPath],
	): TypedClientDocumentAtomic<TCollections, TDocuments>;
	/**
	 * Adds a delete operation to the atomic batch.
	 * @param path The document path template.
	 * @param params Path parameters.
	 * @returns `this` for chaining.
	 */
	delete<TPath extends keyof TDocuments & string>(
		path: TPath,
		params: PathToParams<TPath>,
	): TypedClientDocumentAtomic<TCollections, TDocuments>;
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
	 * Publishes a `payload` to all subscribers of the topic.
	 * @param path The topic path template.
	 * @param params Path parameters.
	 * @param payload The payload to broadcast.
	 * @param signal Optional abort signal.
	 */
	publish<TPath extends keyof TTopics & string>(
		path: TPath,
		params: PathToParams<TPath>,
		payload: TTopics[TPath],
		signal?: AbortSignal,
	): Promise<void>;
	/**
	 * Returns a `ReadableStream` that emits payloads published to the topic.
	 * Opens a WebSocket connection if one is not already active.
	 * The stream unsubscribes automatically when cancelled.
	 * @param path The topic path template.
	 * @param params Path parameters.
	 * @param abortSignal Optional abort signal to cancel the stream.
	 * @returns A stream of incoming payloads.
	 */
	subscribe<TPath extends keyof TTopics & string>(
		path: TPath,
		params: PathToParams<TPath>,
		abortSignal?: AbortSignal,
	): ReadableStream<TTopics[TPath]>;
}

/**
 * Typed table sub-client inferred from an {@link App} registry.
 *
 * @template TTables Map of table names to their row types.
 */
export interface TypedClientTable<
	TTables extends PublicAppRegistry["tables"],
> {
	/**
	 * Executes a query statement against the server's registered tables.
	 * @param fn A callback receiving a {@link BatchableStatementBuilder} typed to the registered tables and returning the statement to execute.
	 * @param params A record of named parameter values to bind.
	 * @param signal Optional abort signal.
	 * @returns The query result.
	 */
	execute<TParams extends Record<string, unknown>, TOutput>(
		fn: (q: BatchableStatementBuilder<TTables, TTables>) => IStatementBuilder<TParams, TOutput>,
		params: TParams,
		signal?: AbortSignal,
	): Promise<TOutput>;
}

/**
 * Typed storage sub-client inferred from an {@link App} registry.
 *
 * @template TFiles Map of file paths.
 * @template TFolders Map of folder paths.
 */
export interface TypedClientStorage<
	TFiles extends PublicAppRegistry["files"],
	TFolders extends PublicAppRegistry["folders"],
> {
	/**
	 * Fetches metadata for a single storage file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param signal Optional abort signal.
	 * @returns The {@link StorageObject} metadata.
	 */
	getMetadata<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		signal?: AbortSignal,
	): Promise<StorageObject>;
	/**
	 * Gets a signed upload URL for the given file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional upload options.
	 * @param signal Optional abort signal.
	 * @returns A {@link StorageSignedUrl} with the upload URL and expiry.
	 */
	getSignedUploadUrl<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedUploadUrlOptions,
		signal?: AbortSignal,
	): Promise<StorageSignedUrl>;
	/**
	 * Gets a signed download URL for the given file.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param options Optional download options.
	 * @param signal Optional abort signal.
	 * @returns A {@link StorageSignedUrl} with the download URL and expiry.
	 */
	getSignedDownloadUrl<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedDownloadUrlOptions,
		signal?: AbortSignal,
	): Promise<StorageSignedUrl>;
	/**
	 * Deletes a file from storage.
	 * @param path The file path template.
	 * @param params Path parameters.
	 * @param signal Optional abort signal.
	 */
	delete<TPath extends keyof TFiles & string>(
		path: TPath,
		params: PathToParams<TPath>,
		signal?: AbortSignal,
	): Promise<void>;
	/**
	 * Lists files under a folder prefix, streaming results.
	 * @param prefix The folder path template.
	 * @param params Path parameters.
	 * @param options Optional listing options (cursor, limit).
	 * @param signal Optional abort signal.
	 * @returns A stream of {@link StorageListEntry} values.
	 */
	list<TPath extends keyof TFolders & string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number },
		signal?: AbortSignal,
	): ReadableStream<StorageListEntry>;
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
