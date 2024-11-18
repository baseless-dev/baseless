// deno-lint-ignore-file no-explicit-any
import { isResults, isResultSingle, Results } from "@baseless/core/result";
import MemoryStorage from "@baseless/core/memory-storage";
import { stableStringify } from "@baseless/core/stable-stringify";
import { assertIdentity, type Identity } from "@baseless/core/identity";
import { type AuthenticationTokens, isAuthenticationTokens } from "@baseless/core/authentication-tokens";
import { EventEmitter } from "@baseless/core/eventemitter";
import { isPathMatching } from "@baseless/core/path";
import { Command, CommandCollectionWatch, isCommandRpc } from "@baseless/core/command";
import type { ApplicationBuilder } from "@baseless/server/application-builder";
import { DocumentAtomic, DocumentListEntry, DocumentListOptions } from "@baseless/server/document-provider";
import { encodeBase64Url } from "@std/encoding/base64url";
import { isEvent } from "@baseless/core/event";
import {
	IClient,
	ICollectionClient,
	ICollectionsClient,
	IDocumentClient,
	IDocumentsClient,
	IEventsClient,
	TypedClientFromApplicationBuilder,
} from "./types.ts";
import { Document, DocumentChange } from "@baseless/core/document";

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

export interface ClientInitialization {
	clientId: string;
	apiEndpoint: string;
	fetch?: typeof globalThis.fetch;
	batchSize?: number;
	storage?: Storage;
}

export class Client implements IClient {
	static fromApplicationBuilder<
		TApplication extends ApplicationBuilder,
	>(initialization: ClientInitialization): TypedClientFromApplicationBuilder<TApplication> {
		return new Client(initialization) as never;
	}

	#internal: ClientInternal;

	constructor(initialization: ClientInitialization) {
		this.#internal = new ClientInternal(initialization);
	}
	get clientId(): string {
		return this.#internal.clientId;
	}
	setStorage(storage: Storage): void {
		this.#internal.setStorage(storage);
	}
	get currentIdentity(): Readonly<Identity> | undefined {
		return this.#internal.getCurrentIdentity();
	}
	onAuthenticationStateChange(listener: (identity: Readonly<Identity> | undefined) => void | Promise<void>): Disposable {
		return this.#internal.authEvents.on("onAuthenticationStateChange", listener);
	}
	rpc(key: string[], input: unknown, dedup?: boolean): Promise<unknown> {
		return this.#internal.rpc(key, input, dedup);
	}
	get collections(): ICollectionsClient {
		return this.#internal.collections.bind(this.#internal);
	}
	get documents(): IDocumentsClient {
		return this.#internal.documents;
	}
	get events(): IEventsClient {
		return this.#internal.events.bind(this.#internal);
	}
	[Symbol.asyncDispose](): PromiseLike<void> {
		return this.#internal[Symbol.asyncDispose]();
	}
}

class ClientInternal implements AsyncDisposable {
	clientId: string;
	apiEndpoint: string;
	fetch: typeof globalThis.fetch;
	batchSize: number;
	#storage!: Storage;
	#tokens: AuthenticationTokens[];
	#currentTokenIndex: number;
	#expirationTimer?: number;
	#accessTokenExpiration?: number;
	authEvents: EventEmitter<{ onAuthenticationStateChange: [identity: Identity | undefined] }>;
	genericEvents: EventEmitter<{ [key: string]: [unknown] }>;
	#socket?: Promise<WebSocket>;

	constructor(initialization: ClientInitialization) {
		this.clientId = initialization.clientId;
		this.apiEndpoint = initialization.apiEndpoint;
		this.fetch = initialization.fetch ?? globalThis.fetch.bind(globalThis);
		this.batchSize = initialization.batchSize ?? 10;
		this.#tokens = [];
		this.#currentTokenIndex = -1;
		this.authEvents = new EventEmitter();
		this.genericEvents = new EventEmitter();
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
		this.#tokens = Array.isArray(tokens) && tokens.every(isAuthenticationTokens) ? tokens : [];
		const currentToken = parseInt(this.#storage.getItem(`baseless:${this.clientId}:currentToken`) ?? "-1", 10);
		this.#currentTokenIndex = currentToken;
	}

	#writeData(): void {
		this.#storage.setItem(`baseless:${this.clientId}:tokens`, JSON.stringify(this.#tokens));
		this.#storage.setItem(`baseless:${this.clientId}:currentToken`, this.#currentTokenIndex.toString());
	}

	#setupTimer(): void {
		const currentToken = this.getCurrentToken();
		if (currentToken) {
			const { exp: accessTokenExp = Number.MAX_VALUE } = JSON.parse(
				atob(currentToken.access_token.split(".").at(1)!),
			);
			const { exp: refreshTokenExp = Number.MAX_VALUE } = currentToken.refresh_token
				? JSON.parse(atob(currentToken.refresh_token.split(".").at(1)!))
				: {};
			const { sub: identityId, data = {} } = JSON.parse(
				atob(currentToken.id_token.split(".").at(1)!),
			);
			const identity = { identityId, data };
			assertIdentity(identity);
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
		if (index >= -1) {
			this.#currentTokenIndex = index;
		} else {
			throw new Error("Invalid token index");
		}
		this.#writeData();
		this.#setupTimer();
	}

	getCurrentIdentity(): Identity | undefined {
		const currentToken = this.getCurrentToken();
		if (currentToken) {
			try {
				const { sub: identityId, data = {} } = JSON.parse(
					atob(currentToken.id_token.split(".").at(1)!),
				);
				const identity = { identityId, data };
				assertIdentity(identity);
				return identity;
			} catch (_error) {}
		}
		return undefined;
	}

	async reauthenticateIfNeeded(): Promise<void> {
		const now = Date.now() / 1000 >> 0;
		const currentToken = this.getCurrentToken();
		// Reauthenticate if token is expired
		if (
			currentToken?.access_token && currentToken.refresh_token &&
			this.#accessTokenExpiration && this.#accessTokenExpiration <= now
		) {
			const response = await this.fetch(this.apiEndpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					kind: "rpc",
					rpc: ["authentication", "refreshAccessToken"],
					input: currentToken.refresh_token,
				}),
			});
			const result = await response.json();
			if (isResultSingle(result) && isAuthenticationTokens(result.value)) {
				this.setTokens([
					...this.#tokens.filter((_, i) => i !== this.#currentTokenIndex),
					result.value,
				]);
				this.setCurrentToken(result.value);
			} else {
				this.setTokens(this.#tokens.filter((_, i) => i !== this.#currentTokenIndex));
				this.setCurrentToken(undefined);
			}
		}
	}

	#commandCache: Map<string, Promise<unknown>> = new Map();
	#commandQueue: Array<
		{
			command: Command;
			resolve: (value: unknown | PromiseLike<unknown>) => void;
			reject: (reason?: any) => void;
		}
	> = [];
	#batchTimout: number | null = null;

	async #processCommandQueue(): Promise<void> {
		await this.reauthenticateIfNeeded();
		const currentToken = this.getCurrentToken();
		const commands = this.#commandQueue.splice(0, this.batchSize);
		try {
			const response = await this.fetch(this.apiEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(currentToken?.access_token ? { Authorization: `Bearer ${currentToken.access_token}` } : {}),
				},
				body: commands.length > 1
					? JSON.stringify({
						kind: "commands",
						commands: commands.map((c) => c.command),
					})
					: JSON.stringify(commands[0].command),
			});
			const result = await response.json();
			const results: Results = isResults(result) ? result : { kind: "results", results: [result] };
			for (const [index, value] of results.results.entries()) {
				if (isResultSingle(value)) {
					const command = commands[index];
					command.resolve(value.value);
					// deno-fmt-ignore
					if (isCommandRpc(command.command)) {
						if (
							(
								isPathMatching(["authentication", "submitPrompt"], command.command.rpc) ||
								isPathMatching(["registration", "submitPrompt"], command.command.rpc) ||
								isPathMatching(["registration", "submitValidationCode"], command.command.rpc)
							) && isAuthenticationTokens(value.value)
						) {
							// Switch to latest tokens
							this.setTokens([...this.#tokens, value.value]);
							this.setCurrentToken(value.value);
						} else if (
							isPathMatching(["authentication", "signOut"], command.command.rpc)
						) {
							this.setTokens(this.#tokens.filter((_, i) => i !== this.#currentTokenIndex));
							this.setCurrentToken(undefined);
						}
					}
				} else {
					commands[index].reject(value.error);
				}
			}
		} catch (error) {
			// TODO if AuthenticationError, clear token
			for (const command of commands) {
				command.reject(error);
			}
		}

		if (this.#commandQueue.length > 0) {
			this.#batchTimout = setTimeout(this.#processCommandQueue.bind(this), 0);
		} else {
			this.#batchTimout = null;
		}
	}

	enqueueCommand(command: Command, dedup: boolean): Promise<unknown> {
		const key = stableStringify(command);
		if (dedup === true) {
			const cachedCommand = this.#commandCache.get(key);
			if (cachedCommand) {
				return cachedCommand;
			}
		}
		const { promise, resolve, reject } = Promise.withResolvers<unknown>();
		this.#commandQueue.push({ command, resolve, reject });
		this.#commandCache.set(key, promise);
		promise.then((_) => this.#commandCache.delete(key));
		if (this.#batchTimout === null) {
			this.#batchTimout = setTimeout(this.#processCommandQueue.bind(this), 0);
		}
		return promise;
	}

	#ensureWebSocket(): Promise<WebSocket> {
		this.#socket ??= new Promise<WebSocket>((resolve, reject) => {
			this.reauthenticateIfNeeded()
				.then(() => {
					const url = new URL(this.apiEndpoint);
					url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
					const currentToken = this.getCurrentToken();
					const protocols: string[] = [];
					if (currentToken?.access_token) {
						protocols.push(`base64url.bearer.authorization.baseless.dev.${encodeBase64Url(currentToken.access_token)}`);
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
					}, { once: true, signal: readyAbortController.signal });
					socket.addEventListener("close", () => {
						messageAbortController.abort();
					}, { signal: messageAbortController.signal });
					socket.addEventListener("message", (e) => {
						const data = e.data;
						const event = JSON.parse(data.toString());
						if (isEvent(event)) {
							this.genericEvents.emit(keyPathToKeyString(event.event), event.payload);
						}
					}, { signal: messageAbortController.signal });

					return ready.promise;
				})
				.then(resolve)
				.catch(reject);
		});
		return this.#socket;
	}

	async sendWebSocketCommand(command: Command): Promise<void> {
		const socket = await this.#ensureWebSocket();
		socket.send(JSON.stringify(command));
	}

	rpc(key: string[], input: unknown, dedup = true): Promise<unknown> {
		return this.enqueueCommand({
			kind: "rpc",
			rpc: key,
			input,
		}, dedup);
	}

	collections(key: string[]): CollectionClient {
		return new CollectionClient(this, key);
	}

	documents: IDocumentsClient = Object.assign(
		(key: string[]) => new DocumentClient(this, key),
		{
			atomic: () => new DocumentAtomicClient(this),
		},
	);

	events(key: string[]): EventClient {
		return new EventClient(this, key);
	}
}

export class DocumentClient implements IDocumentClient {
	#internal: ClientInternal;
	#key: string[];
	constructor(internal: ClientInternal, key: string[]) {
		this.#internal = internal;
		this.#key = key;
	}
	get(): Promise<Document<unknown>> {
		return this.#internal.enqueueCommand({
			kind: "document-get",
			path: this.#key,
		}, false) as never;
	}

	async *watch(abortSignal?: AbortSignal): AsyncIterableIterator<DocumentChange<unknown>> {
		const key = this.#key;
		const event = keyPathToKeyString(["$document", ...this.#key]);
		const abortController = new AbortController();
		const internal = this.#internal;
		// Subscribe if not already subscribed
		if (!internal.genericEvents.listeners().has(event)) {
			internal.sendWebSocketCommand({ kind: "document-watch", key });
		}
		const eventStream = new ReadableStream<DocumentChange<unknown>>({
			start(controller): void {
				const disposable = internal.genericEvents.on(event, (payload) => {
					controller.enqueue(payload as never);
				});
				abortController.signal.addEventListener("abort", () => {
					disposable[Symbol.dispose]();
					controller.close();
				});
			},
			cancel(): void {
				// abortController.abort();
			},
		});
		// Unsubscribe if no listeners left
		abortController.signal.addEventListener("abort", () => {
			if (!internal.genericEvents.listeners().has(event)) {
				internal.sendWebSocketCommand({ kind: "document-unwatch", key });
			}
		});
		abortSignal?.addEventListener("abort", () => abortController.abort());
		yield* eventStream.values();
	}
}

export class DocumentAtomicClient extends DocumentAtomic {
	#internal: ClientInternal;
	constructor(internal: ClientInternal) {
		super();
		this.#internal = internal;
	}
	commit(): Promise<void> {
		return this.#internal.enqueueCommand({
			kind: "document-atomic",
			checks: this.checks,
			ops: this.operations,
		}, false) as never;
	}
}

export class CollectionClient implements ICollectionClient {
	#internal: ClientInternal;
	#key: string[];
	constructor(internal: ClientInternal, key: string[]) {
		this.#internal = internal;
		this.#key = key;
	}
	async *list(options?: Omit<DocumentListOptions, "prefix">): AsyncIterableIterator<DocumentListEntry<unknown>> {
		const entries = await this.#internal.enqueueCommand({
			kind: "document-list",
			prefix: this.#key,
			cursor: options?.cursor,
			limit: options?.limit,
		}, false);
		yield* (entries as any);
	}
	getMany(keys: string[]): Promise<Document<unknown>[]> {
		return this.#internal.enqueueCommand({
			kind: "document-get-many",
			paths: keys.map((key) => [...this.#key, key]),
		}, false) as never;
	}
	async *watch(
		options?: Omit<CommandCollectionWatch, "kind" | "key">,
		abortSignal?: AbortSignal,
	): AsyncIterableIterator<DocumentChange<unknown>> {
		const key = this.#key;
		const event = keyPathToKeyString(["$collection", ...this.#key]);
		const abortController = new AbortController();
		const internal = this.#internal;
		internal.sendWebSocketCommand({ ...options, kind: "collection-watch", key });
		const eventStream = new ReadableStream<DocumentChange<unknown>>({
			start(controller): void {
				const disposable = internal.genericEvents.on(event, (payload) => {
					controller.enqueue(payload as never);
				});
				abortController.signal.addEventListener("abort", () => {
					disposable[Symbol.dispose]();
					controller.close();
				});
			},
			cancel(): void {
				// abortController.abort();
			},
		});
		// Unsubscribe if no listeners left
		abortController.signal.addEventListener("abort", () => {
			internal.sendWebSocketCommand({ ...options, kind: "collection-unwatch", key });
		});
		abortSignal?.addEventListener("abort", () => abortController.abort());
		yield* eventStream.values();
	}
}

export class EventClient {
	#internal: ClientInternal;
	#key: string[];
	constructor(internal: ClientInternal, key: string[]) {
		this.#internal = internal;
		this.#key = key;
	}

	publish(payload: unknown): Promise<void> {
		return this.#internal.sendWebSocketCommand({
			kind: "event-publish",
			event: this.#key,
			payload,
		});
	}

	async *subscribe(abortSignal?: AbortSignal): AsyncIterableIterator<unknown> {
		const key = this.#key;
		const event = keyPathToKeyString(key);
		const abortController = new AbortController();
		const internal = this.#internal;
		// Subscribe if not already subscribed
		if (!internal.genericEvents.listeners().has(event)) {
			internal.sendWebSocketCommand({ kind: "event-subscribe", event: key });
		}
		const eventStream = new ReadableStream<unknown>({
			start(controller): void {
				const disposable = internal.genericEvents.on(event, (payload) => {
					controller.enqueue(payload);
				});
				abortController.signal.addEventListener("abort", () => {
					disposable[Symbol.dispose]();
					controller.close();
				});
			},
			cancel(): void {
				// abortController.abort();
			},
		});
		// Unsubscribe if no listeners left
		abortController.signal.addEventListener("abort", () => {
			if (!internal.genericEvents.listeners().has(event)) {
				internal.sendWebSocketCommand({ kind: "event-unsubscribe", event: key });
			}
		});
		abortSignal?.addEventListener("abort", () => abortController.abort());
		yield* eventStream.values();
	}
}
