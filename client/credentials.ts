import { EventEmitter } from "@baseless/client/event-emitter";
import { type AuthenticationTokens, AuthenticationTokensObject } from "@baseless/core/authentication-tokens";

/**
 * Persistence backend for {@link Credentials}. Implement this interface to
 * store tokens in any durable medium (e.g. `localStorage`, a database).
 */
export interface CredentialsStore {
	set(tokens: AuthenticationTokens[]): Promise<void>;
	get(): Promise<AuthenticationTokens[]>;
}

/**
 * Manages a collection of {@link AuthenticationTokensObject} instances and
 * tracks the currently active identity.
 *
 * Tokens are persisted via the {@link CredentialsStore} provided at
 * construction time (defaults to {@link MemoryCredentialsStore}).
 *
 * @example
 * ```ts
 * import { Credentials } from "@baseless/client";
 *
 * const creds = new Credentials();
 * await creds.add(myTokens);
 * console.log(creds.tokens?.identity.id);
 * ```
 */
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

	/** The {@link AuthenticationTokensObject} for the active identity, or `null` if none. */
	get tokens(): AuthenticationTokensObject | null {
		if (this.#identityId) {
			return this.#tokens.get(this.#identityId) ?? null;
		}
		return null;
	}

	/**
	 * Registers a handler that is called whenever the active tokens change.
	 * @param handler Callback receiving the new tokens (or `null` when signed out).
	 * @returns A {@link Disposable} that removes the listener when disposed.
	 */
	onChange(handler: (tokens: AuthenticationTokensObject | null) => void): Disposable {
		return this.#emitter.on("tokens", handler);
	}

	/**
	 * Sets the active identity to `identityId` (or `undefined` to clear it).
	 * Fires the `tokens` event and sets up the expiration timer.
	 * @param identityId The identity ID to make active, or `undefined` to sign out.
	 */
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

	/**
	 * Removes the stored tokens for `identityId` and signs out if it was
	 * the active identity.
	 * @param identityId The identity to remove.
	 */
	async remove(identityId: string): Promise<void> {
		this.#tokens.delete(identityId);
		await this.#storage.set(Array.from(this.#tokens.values()).map((to) => to.tokens));
		if (this.#identityId === identityId) {
			await this.switchTo(undefined);
		}
	}

	/**
	 * Adds or replaces tokens for an identity. If no identity is currently
	 * active the new identity is automatically activated.
	 * @param tokens The tokens to store (raw {@link AuthenticationTokens} or an
	 * {@link AuthenticationTokensObject}).
	 */
	async add(tokens: AuthenticationTokens | AuthenticationTokensObject): Promise<void> {
		const tokensObject = tokens instanceof AuthenticationTokensObject ? tokens : new AuthenticationTokensObject(tokens);
		this.#tokens.set(tokensObject.identity.id, tokensObject);
		await this.#storage.set(Array.from(this.#tokens.values()).map((to) => to.tokens));
		if (!this.#identityId) {
			await this.switchTo(tokensObject.identity.id);
		}
	}
}

/**
 * In-memory {@link CredentialsStore} implementation. Tokens are not persisted
 * across page reloads. Useful for testing or server-side scenarios.
 */
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

/**
 * {@link CredentialsStore} backed by `window.localStorage` (or any
 * `Storage`-compatible object).
 *
 * @example
 * ```ts
 * import { Credentials, StorageCredentialsStore } from "@baseless/client";
 *
 * const creds = new Credentials(new StorageCredentialsStore());
 * ```
 */
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
