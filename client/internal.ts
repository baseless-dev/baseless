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
import { TokensManager, TokensMetadata } from "./tokens_manager.ts";

export interface ClientInitialization {
	clientId: string;
	apiEndpoint: string;
	tokenIndex?: number;
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
	#tokensManager: TokensManager;
	#currentIdentity: Identity["id"] | undefined;
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
		this.#tokensManager = new TokensManager();
		this.authEvents = new EventEmitter();
		this.pubsubMessages = new EventEmitter();
		this.setStorage(initialization.storage ?? new MemoryStorage());
		this.#readData();
		const tokenIndex = initialization.tokenIndex ?? 0;
		const current = this.#tokensManager.getByIndex(tokenIndex);
		this.#currentIdentity = current ? current.identity.id : undefined;
		this.#triggerUpdate();
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
		this.#triggerUpdate();
	}

	identities(): IterableIterator<TokensMetadata> {
		return Array.from(this.#tokensManager).values();
	}

	removeIdentity(identityId: Identity["id"]): void {
		this.#tokensManager.remove(identityId);
		if (this.#currentIdentity === identityId) {
			this.setCurrentTokensMetadata(undefined);
		}
		this.#writeData();
		this.#triggerUpdate();
	}

	#readData(): void {
		const rawTokens = JSON.parse(this.#storage.getItem(`baseless:${this.clientId}:tokens`) ?? "{}");
		const tokens = Array.isArray(rawTokens) && rawTokens.every((t) => Type.validate(AuthenticationTokens, t)) ? rawTokens : [];
		this.#tokensManager = new TokensManager(tokens);
	}

	#writeData(): void {
		const tokens = Array.from(this.#tokensManager).map((m) => m.tokens);
		this.#storage.setItem(`baseless:${this.clientId}:tokens`, JSON.stringify(tokens));
	}

	#triggerUpdate(): void {
		const currentMeta = this.getCurrentTokensMetadata();
		if (currentMeta) {
			this.#accessTokenExpiration = currentMeta.accessTokenExpiration;
			this.#expirationTimer = setTimeout(
				() => {
					this.setCurrentTokensMetadata(undefined);
				},
				(currentMeta.refreshTokenExpiration ?? currentMeta.accessTokenExpiration) * 1000 - Date.now(),
			);
			this.authEvents.emit("onAuthenticationStateChange", currentMeta.identity);
		} else {
			this.#expirationTimer && clearTimeout(this.#expirationTimer);
			this.#expirationTimer = undefined;
			this.authEvents.emit("onAuthenticationStateChange", undefined);
		}
	}

	getCurrentTokensMetadata(): TokensMetadata | undefined {
		return this.#currentIdentity ? this.#tokensManager.getByIdentityId(this.#currentIdentity) : undefined;
	}

	setCurrentTokensMetadata(value: Identity["id"] | undefined): void {
		if (!value || this.#tokensManager.getByIdentityId(value)) {
			this.#currentIdentity = value;
			this.#triggerUpdate();
		}
	}

	async reauthenticateIfNeeded(signal?: AbortSignal): Promise<void> {
		const now = Date.now() / 1000 >> 0;
		const current = this.getCurrentTokensMetadata();
		// Reauthenticate if token is expired
		if (
			current?.tokens.accessToken && current.tokens.refreshToken &&
			this.#accessTokenExpiration && this.#accessTokenExpiration <= now
		) {
			const response = await this.#fetch(`${this.apiEndpoint}/auth/refresh-token`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(current.tokens.refreshToken),
				signal,
			});
			const result = await response.json();
			if (Type.validate(AuthenticationTokens, result)) {
				this.#tokensManager.add(result);
				this.#writeData();
				this.#triggerUpdate();
			} else {
				this.setCurrentTokensMetadata(undefined);
			}
		}
	}

	async fetch(endpoint: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
		await this.reauthenticateIfNeeded(signal);
		const currentMeta = this.getCurrentTokensMetadata();
		const response = await this.#fetch(
			new Request(`${this.apiEndpoint}${endpoint}`, {
				method: body ? "POST" : "GET",
				headers: {
					"Content-Type": "application/json",
					...(currentMeta?.tokens.accessToken ? { Authorization: `Bearer ${currentMeta?.tokens.accessToken}` } : {}),
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
			const meta = this.#tokensManager.add(result);
			this.#currentIdentity = meta.identity.id;
			this.#writeData();
			this.#triggerUpdate();
		} else if (endpoint === "auth/sign-out" && result) {
			this.setCurrentTokensMetadata(undefined);
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
					const currentMeta = this.getCurrentTokensMetadata();
					const protocols: string[] = ["bls"];
					if (currentMeta?.tokens.accessToken) {
						protocols.push(`base64url.bearer.authorization.baseless.dev.${encodeBase64Url(currentMeta.tokens.accessToken)}`);
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

	pubsubSubscribe(path: string, _abortSignal?: AbortSignal): ReadableStream<unknown> {
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
