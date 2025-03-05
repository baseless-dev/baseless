import { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { Identity } from "@baseless/core/identity";
import { EventEmitter } from "./event_emitter.ts";
import MemoryStorage from "./memory_storage.ts";
import * as Type from "@baseless/core/schema";
import type {
	Document,
	DocumentAtomicCheck,
	DocumentAtomicOperation,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
} from "@baseless/core/document";
import { encodeBase64Url } from "@std/encoding/base64url";

export interface ClientInitialization {
	clientId: string;
	apiEndpoint: string;
	fetch?: typeof globalThis.fetch;
	batchSize?: number;
	storage?: Storage;
}

export class ClientInternal implements AsyncDisposable {
	clientId: string;
	apiEndpoint: string;
	#fetch: typeof globalThis.fetch;
	batchSize: number;
	#storage!: Storage;
	#tokens: AuthenticationTokens[];
	#currentTokenIndex: number;
	#expirationTimer?: number;
	#accessTokenExpiration?: number;
	authEvents: EventEmitter<{ onAuthenticationStateChange: Identity | undefined }>;
	pubsubMessages: EventEmitter<{ [key: string]: unknown }>;
	#socket?: Promise<WebSocket>;

	constructor(initialization: ClientInitialization) {
		this.clientId = initialization.clientId;
		this.apiEndpoint = new URL(initialization.apiEndpoint).toString();
		this.#fetch = initialization.fetch ?? globalThis.fetch.bind(globalThis);
		this.batchSize = initialization.batchSize ?? 10;
		this.#tokens = [];
		this.#currentTokenIndex = -1;
		this.authEvents = new EventEmitter();
		this.pubsubMessages = new EventEmitter();
		this.setStorage(initialization.storage ?? new MemoryStorage());
		this.#readData();
		this.#setupTimer();
	}

	async [Symbol.asyncDispose](): Promise<void> {
		if (this.#expirationTimer) {
			clearTimeout(this.#expirationTimer);
		}
		const socket = await this.#socket;
		if (socket) {
			socket.close();
			this.#socket = undefined;
		}
	}

	setStorage(storage: Storage): void {
		this.#storage = storage;
		this.#readData();
		this.#setupTimer();
	}

	#readData(): void {
		const tokens = JSON.parse(this.#storage.getItem(`baseless:${this.clientId}:tokens`) ?? "{}");
		this.#tokens = Array.isArray(tokens) && tokens.every((t) => Type.validate(AuthenticationTokens, t)) ? tokens : [];
	}

	#writeData(): void {
		this.#storage.setItem(`baseless:${this.clientId}:tokens`, JSON.stringify(this.#tokens));
	}

	#setupTimer(): void {
		const currentToken = this.getCurrentToken();
		if (currentToken) {
			const { exp: accessTokenExp = Number.MAX_VALUE } = JSON.parse(
				atob(currentToken.accessToken.split(".").at(1)!),
			);
			const { exp: refreshTokenExp = Number.MAX_VALUE } = currentToken.refreshToken
				? JSON.parse(atob(currentToken.refreshToken.split(".").at(1)!))
				: {};
			const { sub: id, claims = {} } = JSON.parse(
				atob(currentToken.idToken.split(".").at(1)!),
			);
			const identity = { id, data: claims };
			Type.assert(Identity, identity);
			const expiration = parseInt(refreshTokenExp ?? accessTokenExp, 10);
			this.#accessTokenExpiration = parseInt(accessTokenExp, 10);
			this.#expirationTimer = setTimeout(
				() => {
					this.setCurrentToken(undefined);
				},
				expiration * 1000 - Date.now(),
			);
			this.authEvents.emit("onAuthenticationStateChange", identity);
		} else {
			this.#expirationTimer && clearTimeout(this.#expirationTimer);
			this.#expirationTimer = undefined;
			this.authEvents.emit("onAuthenticationStateChange", undefined);
		}
	}

	setTokens(value: AuthenticationTokens[]): void {
		// TODO dedup idToken.sub
		this.#tokens = value;
		this.#writeData();
		if (this.#currentTokenIndex >= this.#tokens.length) {
			this.#currentTokenIndex = -1;
		}
	}

	getCurrentToken(): AuthenticationTokens | undefined {
		return this.#tokens[this.#currentTokenIndex];
	}

	setCurrentToken(value: AuthenticationTokens | undefined): void {
		const index = !value ? -1 : this.#tokens.indexOf(value);
		this.#currentTokenIndex = index;
		this.#writeData();
		this.#setupTimer();
	}

	getCurrentIdentity(): Identity | undefined {
		const currentToken = this.getCurrentToken();
		if (currentToken) {
			try {
				const { sub: id, claims = {} } = JSON.parse(
					atob(currentToken.idToken.split(".").at(1)!),
				);
				const identity = { id, data: claims };
				Type.assert(Identity, identity);
				return identity;
			} catch (_error) {}
		}
		return undefined;
	}

	async reauthenticateIfNeeded(signal?: AbortSignal): Promise<void> {
		const now = Date.now() / 1000 >> 0;
		const currentToken = this.getCurrentToken();
		// Reauthenticate if token is expired
		if (
			currentToken?.accessToken && currentToken.refreshToken &&
			this.#accessTokenExpiration && this.#accessTokenExpiration <= now
		) {
			const response = await this.#fetch(`${this.apiEndpoint}/auth/refresh-token`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(currentToken.refreshToken),
				signal,
			});
			const result = await response.json();
			if (Type.validate(AuthenticationTokens, result)) {
				this.setTokens([
					...this.#tokens.filter((_, i) => i !== this.#currentTokenIndex),
					result,
				]);
				this.setCurrentToken(result);
			} else {
				this.setCurrentToken(undefined);
			}
		}
	}

	async fetch(endpoint: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
		await this.reauthenticateIfNeeded(signal);
		const response = await this.#fetch(
			new Request(`${this.apiEndpoint}${endpoint}`, {
				method: body ? "POST" : "GET",
				headers: {
					"Content-Type": "application/json",
					...(this.getCurrentToken()?.accessToken ? { Authorization: `Bearer ${this.getCurrentToken()?.accessToken}` } : {}),
				},
				body: JSON.stringify(body),
				signal,
			}),
		);
		const result = await response.json().catch((_) => undefined);
		if (
			(
				endpoint === "auth/begin" ||
				endpoint === "auth/submit-prompt" ||
				endpoint === "auth/submit-validation-code" ||
				endpoint === "auth/refresh-token"
			) &&
			Type.validate(AuthenticationTokens, result)
		) {
			this.setTokens([...this.#tokens, result]);
			this.setCurrentToken(result);
		} else if (endpoint === "auth/sign-out" && result) {
			this.setCurrentToken(undefined);
		}
		return result;
	}

	documentGet(path: string, options?: DocumentGetOptions, abortSignal?: AbortSignal): Promise<Document> {
		return this.fetch("document/get", { path, options }, abortSignal) as never;
	}

	documentGetMany(paths: string[], options?: DocumentGetOptions, abortSignal?: AbortSignal): Promise<Document[]> {
		return this.fetch("document/get-many", { paths, options }, abortSignal) as never;
	}

	documentList(options: DocumentListOptions, abortSignal?: AbortSignal): ReadableStream<DocumentListEntry> {
		const abortController = new AbortController();
		abortSignal?.addEventListener("abort", () => abortController.abort(), { once: true });
		return new ReadableStream<DocumentListEntry>({
			start: async (controller): Promise<void> => {
				const results = await this.fetch("document/list", options, abortController.signal) as unknown as DocumentListEntry[];
				for (const result of results) {
					controller.enqueue(result);
				}
				controller.close();
			},
			cancel: () => {
				abortController.abort();
			},
		});
	}

	documentCommit(checks: DocumentAtomicCheck[], operations: DocumentAtomicOperation[], abortSignal?: AbortSignal): Promise<void> {
		return this.fetch("document/commit", { checks, operations }, abortSignal) as never;
	}

	pubsubPublish(key: string, payload: unknown, abortSignal?: AbortSignal): Promise<void> {
		return this.fetch("pubsub/publish", { key, payload }, abortSignal) as never;
	}

	#ensureWebSocketOpen(): Promise<WebSocket> {
		this.#socket ??= new Promise<WebSocket>((resolve, reject) => {
			this.reauthenticateIfNeeded()
				.then(() => {
					const url = new URL(this.apiEndpoint);
					url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
					const currentToken = this.getCurrentToken();
					const protocols: string[] = ["bls"];
					if (currentToken?.accessToken) {
						protocols.push(`base64url.bearer.authorization.baseless.dev.${encodeBase64Url(currentToken.accessToken)}`);
					}
					const ready = Promise.withResolvers<WebSocket>();
					const readyAbortController = new AbortController();
					const messageAbortController = new AbortController();
					const socket = new WebSocket(url, protocols);
					socket.addEventListener("open", () => {
						ready.resolve(socket);
						readyAbortController.abort();
					}, { once: true, signal: readyAbortController.signal });
					socket.addEventListener("close", (event) => {
						ready.reject(event);
						readyAbortController.abort();
						messageAbortController.abort();
					}, { once: true, signal: readyAbortController.signal });
					socket.addEventListener("close", () => {
						messageAbortController.abort();
						this.#socket = undefined;
					}, { signal: messageAbortController.signal });
					socket.addEventListener("message", async (e) => {
						const data = e.data;
						const event = JSON.parse(data.toString());
						await this.pubsubMessages.emit(event.key, event.payload);
					}, { signal: messageAbortController.signal });

					return ready.promise;
				})
				.then(resolve)
				.catch((reason) => {
					this.#socket = undefined;
					reject(reason);
				});
		});
		return this.#socket;
	}

	pubsubSubscribe(path: string, abortSignal?: AbortSignal): ReadableStream<unknown> {
		let listener: Disposable;
		let socket: WebSocket;
		return new ReadableStream<unknown>({
			start: async (controller): Promise<void> => {
				socket = await this.#ensureWebSocketOpen();
				if (!this.pubsubMessages.hasListener(path)) {
					socket.send(JSON.stringify({ type: "subscribe", key: path }));
				}
				listener = this.pubsubMessages.on(path, (arg) => controller.enqueue(arg));
			},
			cancel: () => {
				listener?.[Symbol.dispose]();
				if (!this.pubsubMessages.hasListener(path)) {
					socket?.send(JSON.stringify({ type: "unsubscribe", key: path }));
				}
			},
		});
	}
}
