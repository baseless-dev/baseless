// deno-lint-ignore-file no-explicit-any
import type { Static } from "@sinclair/typebox";
import { isResultError, isResults, isResultSingle } from "@baseless/core/result";
import MemoryStorage from "@baseless/core/memory-storage";
import { stableStringify } from "@baseless/core/stable-stringify";
import { assertIdentity, type Identity } from "@baseless/core/identity";
import { type AuthenticationTokens, isAuthenticationTokens } from "@baseless/core/authentication-tokens";
import { EventEmitter } from "@baseless/core/eventemitter";
import { isPathMatching } from "@baseless/core/path";
import { Command, isCommandRpc } from "@baseless/core/command";
import type { ApplicationBuilder } from "@baseless/server/application-builder";
import type {
	CollectionDefinition,
	DocumentDefinition,
	EventDefinition,
	PickAtPath,
	RpcDefinition,
	WithSecurity,
} from "@baseless/server/types";

export interface ClientInitialization {
	clientId: string;
	apiEndpoint: string;
	fetch?: typeof globalThis.fetch;
	batchSize?: number;
}

// deno-fmt-ignore
export type ClientFromApplicationBuilder<T extends ApplicationBuilder> = T extends
	ApplicationBuilder<any, infer TRpc, infer TEvent, infer TDocument, infer TCollection, infer TFile, infer TFolder>
	? TypedClient<WithSecurity<TRpc>, WithSecurity<TEvent>, WithSecurity<TDocument>, WithSecurity<TCollection>, WithSecurity<TFile>, WithSecurity<TFolder>>
	: never;

export class Client {
	static fromApplicationBuilder<
		TApplication extends ApplicationBuilder,
	>(initialization: ClientInitialization): ClientFromApplicationBuilder<TApplication> {
		return new Client(initialization) as never;
	}

	#clientId: string;
	#apiEndpoint: string;
	#fetch: typeof globalThis.fetch;
	#batchSize: number;
	#storage!: Storage;
	#tokens: AuthenticationTokens[];
	#currentTokenIndex: number;
	#expirationTimer?: number;
	#accessTokenExpiration?: number;
	#events: EventEmitter<{ onAuthenticationStateChange: [identity: Identity | undefined] }>;

	constructor(initialization: ClientInitialization) {
		this.#clientId = initialization.clientId;
		this.#apiEndpoint = initialization.apiEndpoint;
		this.#fetch = initialization.fetch ?? globalThis.fetch.bind(globalThis);
		this.#batchSize = initialization.batchSize ?? 10;
		this.#tokens = [];
		this.#currentTokenIndex = -1;
		this.#events = new EventEmitter();
		this.storage = new MemoryStorage();
	}

	[Symbol.dispose](): void {
		this.#expirationTimer && clearTimeout(this.#expirationTimer);
	}

	dispose(): void {
		this[Symbol.dispose]();
	}

	get storage(): Storage {
		return this.#storage;
	}

	set storage(storage: Storage) {
		this.#storage = storage;
		this.#readData();
		this.#setupTimer();
	}

	get tokens(): ReadonlyArray<Readonly<AuthenticationTokens>> {
		return this.#tokens;
	}

	set tokens(value: AuthenticationTokens[]) {
		this.#tokens = value;
		this.#writeData();
		if (this.#currentTokenIndex >= this.#tokens.length) {
			this.#currentTokenIndex = -1;
		}
	}

	get currentToken(): AuthenticationTokens | undefined {
		return this.#tokens[this.#currentTokenIndex];
	}

	set currentToken(value: AuthenticationTokens | undefined) {
		if (!value) {
			this.#currentTokenIndex = -1;
			this.#writeData();
			this.#setupTimer();
			return;
		}
		const index = this.#tokens.indexOf(value);
		if (index > -1) {
			this.#currentTokenIndex = index;
			this.#writeData();
			this.#setupTimer();
		} else {
			throw new Error("Invalid token index");
		}
	}

	get currentIdentity(): Identity | undefined {
		const currentToken = this.currentToken;
		if (currentToken) {
			try {
				const { sub: identityId, data } = JSON.parse(
					atob(currentToken.id_token.split(".").at(1)!),
				);
				const identity = { identityId, data };
				assertIdentity(identity);
				return identity;
			} catch (_error) {}
		}
		return undefined;
	}

	#readData(): void {
		const tokens = JSON.parse(
			this.#storage.getItem(`baseless:${this.#clientId}:tokens`) ?? "{}",
		);
		this.#tokens = Array.isArray(tokens) && tokens.every(isAuthenticationTokens) ? tokens : [];
		const currentToken = parseInt(
			this.#storage.getItem(`baseless:${this.#clientId}:currentToken`) ?? "-1",
			10,
		);
		this.#currentTokenIndex = currentToken;
	}

	#writeData(): void {
		this.#storage.setItem(`baseless:${this.#clientId}:tokens`, JSON.stringify(this.#tokens));
		this.#storage.setItem(
			`baseless:${this.#clientId}:currentToken`,
			this.#currentTokenIndex.toString(),
		);
	}

	#setupTimer(): void {
		const currentToken = this.currentToken;
		if (currentToken) {
			const { exp: accessTokenExp = Number.MAX_VALUE } = JSON.parse(
				atob(currentToken.access_token.split(".").at(1)!),
			);
			const { exp: refreshTokenExp = Number.MAX_VALUE } = currentToken.refresh_token
				? JSON.parse(atob(currentToken.refresh_token.split(".").at(1)!))
				: {};
			const { sub: identityId, data } = JSON.parse(
				atob(currentToken.id_token.split(".").at(1)!),
			);
			const identity = { identityId, data };
			assertIdentity(identity);
			const expiration = parseInt(refreshTokenExp ?? accessTokenExp, 10);
			this.#accessTokenExpiration = parseInt(accessTokenExp, 10);
			this.#expirationTimer = setTimeout(
				() => {
					this.currentToken = undefined;
				},
				expiration * 1000 - Date.now(),
			);
			this.#events.emit("onAuthenticationStateChange", identity);
		} else {
			this.#expirationTimer && clearTimeout(this.#expirationTimer);
			this.#expirationTimer = undefined;
			this.#events.emit("onAuthenticationStateChange", undefined);
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
		const now = Date.now() / 1000 >> 0;
		let currentToken = this.currentToken;
		// Reauthenticate if token is expired
		if (
			currentToken?.access_token && currentToken.refresh_token &&
			this.#accessTokenExpiration && this.#accessTokenExpiration <= now
		) {
			const response = await this.#fetch(this.#apiEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					kind: "command",
					rpc: ["authentication", "refreshToken"],
					input: currentToken.refresh_token,
				}),
			});
			const token = await response.json();
			if (isAuthenticationTokens(token)) {
				this.tokens = [
					...this.tokens.filter((_, i) => i !== this.#currentTokenIndex),
					token,
				];
				this.currentToken = token;
				currentToken = token;
			} else {
				this.tokens = this.tokens.filter((_, i) => i !== this.#currentTokenIndex);
				this.currentToken = undefined;
			}
		}
		const commands = this.#commandQueue.splice(0, this.#batchSize);
		try {
			const response = await this.#fetch(this.#apiEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(currentToken?.access_token ? { Authorization: `Bearer ${currentToken.access_token}` } : {}),
				},
				body: JSON.stringify({
					kind: "commands",
					commands: commands.map((c) => c.command),
				}),
			});
			const result = await response.json();
			if (isResults(result)) {
				for (const [index, value] of result.results.entries()) {
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
								this.tokens = [...this.tokens, value.value];
								this.currentToken = value.value;
							} else if (
								isPathMatching(["authentication", "signOut"], command.command.rpc)
							) {
								this.tokens = this.tokens.filter((_, i) => i !== this.#currentTokenIndex);
								this.currentToken = undefined;
							}
						}
					} else {
						commands[index].reject(value.error);
					}
				}
			} else if (isResultError(result)) {
				// TODO if authentication token error, clear token
				for (const command of commands) {
					command.reject(result.error);
				}
			} else {
				throw "UnknownError";
			}
		} catch (error) {
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

	#enqueueCommand(command: Command, dedup: boolean): Promise<unknown> {
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

	onAuthenticationStateChange(
		listener: (identity: Identity | undefined) => void | Promise<void>,
	): Disposable {
		return this.#events.on("onAuthenticationStateChange", listener);
	}

	rpc(key: string[], input: unknown, dedup = true): Promise<unknown> {
		return this.#enqueueCommand({
			kind: "rpc",
			rpc: key,
			input,
		}, dedup);
	}
}

export interface TypedClient<
	TRpc extends Array<RpcDefinition<any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> extends Client {
	rpc<
		const TRpcPath extends TRpc[number]["matcher"],
		const TRpcDefinition extends PickAtPath<TRpc, TRpcPath>,
	>(
		key: TRpcPath,
		input: Static<TRpcDefinition["input"]>,
		dedup?: boolean,
	): Promise<Static<TRpcDefinition["output"]>>;
}
