import { EventEmitter } from "@baseless/client/event-emitter";
import { type AuthenticationTokens, AuthenticationTokensObject } from "@baseless/core/authentication-tokens";

export interface CredentialsStore {
	set(tokens: AuthenticationTokens[]): Promise<void>;
	get(): Promise<AuthenticationTokens[]>;
}

export class Credentials implements Disposable {
	#emitter: EventEmitter<{ tokens: AuthenticationTokensObject | null }>;
	#tokens: Map<string, AuthenticationTokensObject>;
	#storage: CredentialsStore;
	#identityId?: string;
	#expirationTimer?: number;

	constructor(storage: CredentialsStore = new MemoryCredentialsStore(), identityId?: string) {
		this.#emitter = new EventEmitter();
		this.#tokens = new Map();
		this.#storage = storage;
		this.#identityId = identityId;

		this.#storage.get().then((tokens) => {
			for (const t of tokens) {
				this.add(t);
			}
		});
	}

	[Symbol.dispose](): void {
		this.#tokens.clear();
		clearTimeout(this.#expirationTimer);
		this.#expirationTimer = undefined;
		this.#emitter[Symbol.dispose]();
	}

	[Symbol.iterator](): IterableIterator<AuthenticationTokensObject> {
		return this.#tokens.values();
	}

	get tokens(): AuthenticationTokensObject | null {
		if (this.#identityId) {
			return this.#tokens.get(this.#identityId) ?? null;
		}
		return null;
	}

	onChange(handler: (tokens: AuthenticationTokensObject | null) => void): Disposable {
		return this.#emitter.on("tokens", handler);
	}

	async switchTo(identityId?: string): Promise<void> {
		if (this.#identityId !== identityId) {
			this.#identityId = identityId;
			const tokens = this.tokens;
			await this.#emitter.emit("tokens", tokens);
			clearTimeout(this.#expirationTimer);
			if (tokens) {
				const expiration = tokens.refreshTokenExpiration ?? tokens.accessTokenExpiration;
				this.#expirationTimer = setTimeout(async () => {
					await this.switchTo(undefined);
				}, expiration * 1000 - Date.now());
			}
		}
	}

	async remove(identityId: string): Promise<void> {
		this.#tokens.delete(identityId);
		await this.#storage.set(Array.from(this.#tokens.values()).map((to) => to.tokens));
		if (this.#identityId === identityId) {
			await this.switchTo(undefined);
		}
	}

	async add(tokens: AuthenticationTokens | AuthenticationTokensObject): Promise<void> {
		const tokensObject = tokens instanceof AuthenticationTokensObject ? tokens : new AuthenticationTokensObject(tokens);
		this.#tokens.set(tokensObject.identity.id, tokensObject);
		await this.#storage.set(Array.from(this.#tokens.values()).map((to) => to.tokens));
		if (!this.#identityId) {
			await this.switchTo(tokensObject.identity.id);
		}
	}
}

export class MemoryCredentialsStore implements CredentialsStore {
	#tokens: AuthenticationTokens[];

	constructor() {
		this.#tokens = [];
	}

	// deno-lint-ignore require-await
	async set(tokens: AuthenticationTokens[]): Promise<void> {
		this.#tokens = tokens;
	}

	// deno-lint-ignore require-await
	async get(): Promise<AuthenticationTokens[]> {
		return this.#tokens;
	}
}

export class StorageCredentialsStore implements CredentialsStore {
	#storageKey: string;
	#storage: globalThis.Storage;

	constructor(storage: globalThis.Storage = localStorage, storageKey: string = "baseless-authentication-tokens") {
		this.#storage = storage;
		this.#storageKey = storageKey;
	}

	// deno-lint-ignore require-await
	async set(tokens: AuthenticationTokens[]): Promise<void> {
		this.#storage.setItem(this.#storageKey, JSON.stringify(tokens));
	}

	// deno-lint-ignore require-await
	async get(): Promise<AuthenticationTokens[]> {
		const item = this.#storage.getItem(this.#storageKey);
		if (!item) return [];
		return JSON.parse(item);
	}
}
