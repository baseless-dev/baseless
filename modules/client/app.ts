import { importSPKI } from "https://deno.land/x/jose@v4.3.7/key/import.ts";
import { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
import { Command, Result } from "https://baseless.dev/x/shared/server.ts";
import { Auth } from "./auth.ts";
import { Lock } from "./utils.ts";
import { ITransport } from "./transports/mod.ts";
import { BatchTransport } from "./transports/batch.ts";
import { FetchTransport } from "./transports/fetch.ts";
import { PrefixedStorage } from "./storages/prefixed.ts";
import { MemoryStorage } from "./storages/memory.ts";

/**
 * A BaselessApp holds the initialization information for a collection of services.
 */
export class App {
	/**
	 * Construct an `App` object
	 * @internal
	 */
	public constructor(
		protected readonly _clientId: string,
		protected readonly _clientPublicKey: KeyLike,
		protected _storage: Storage,
		protected _transport: ITransport,
	) {}

	protected _auth?: Auth;
	protected _refreshTokensLock = new Lock();

	public getAuth(): Auth | undefined {
		return this._auth;
	}

	public setAuth(auth: Auth) {
		this._auth = auth;
	}

	public getClientId() {
		return this._clientId;
	}

	public getClientPublicKey() {
		return this._clientPublicKey;
	}

	public getStorage() {
		return this._storage;
	}

	public setStorage(storage: Storage, migrateData = true, clearPrevious = true) {
		const newStorage = new PrefixedStorage(`baseless_${this._clientId}`, storage);
		if (migrateData) {
			const l = this._storage.length;
			for (let i = 0; i < l; ++i) {
				const key = this._storage.key(i)!;
				const value = this._storage.getItem(key)!;
				newStorage.setItem(key, value);
			}
		}
		if (clearPrevious) {
			this._storage.clear();
		}
		this._storage = newStorage;
	}

	public getTransport() {
		return this._transport;
	}

	public setTransport(transport: ITransport) {
		this._transport = transport;
	}

	public async send(command: Command): Promise<Result> {
		const auth = this.getAuth();
		if (!this._refreshTokensLock.isLock) {
			// Check tokens expiration and try to fetch new one if needed
			const tokens = auth?.getTokens();
			if (tokens) {
				const now = new Date();
				const access_exp = new Date((tokens.access_result.exp ?? 0) * 1000);
				// Access token is expired
				if (access_exp <= now) {
					// If valid refresh token, try refreshing tokens
					if ("refresh_token" in tokens) {
						const refresh_exp = new Date((tokens.refresh_result.exp ?? 0) * 1000);
						if (refresh_exp >= now) {
							// Prevent other command from refreshing the token
							this._refreshTokensLock.lock();
							const res = await this._transport.send(this, {
								cmd: "auth.refresh-tokens",
								refresh_token: tokens.refresh_token,
							});
							if ("id_token" in res && "access_token" in res) {
								await auth!.setTokens(res);
							}
							// Unlock other commands
							this._refreshTokensLock.unlock();
						}
					}
				}
			}
		} else {
			// Wait for previous refresh token to finish
			await this._refreshTokensLock.waiter;
		}
		return this._transport.send(this, command);
	}
}

/**
 * Creates and initializes a `BaselessApp`.
 */
export function initializeApp(options: {
	baselessUrl: string;
	clientId: string;
	clientPublicKey: string;
	clientPublicKeyAlg: string;
}) {
	const { clientId, clientPublicKey, clientPublicKeyAlg, baselessUrl } = options;
	const transport = new BatchTransport(new FetchTransport(baselessUrl));
	return initializeAppWithTransport({
		clientId,
		clientPublicKey,
		clientPublicKeyAlg,
		transport,
	});
}

/**
 * Creates and initializes a `BaselessApp` with ITransport
 */
export async function initializeAppWithTransport(options: {
	clientId: string;
	clientPublicKey: string;
	clientPublicKeyAlg: string;
	transport: ITransport;
}) {
	const publicKey = await importSPKI(
		options.clientPublicKey,
		options.clientPublicKeyAlg,
	);
	const storage = new MemoryStorage();
	return new App(options.clientId, publicKey, storage, options.transport);
}
