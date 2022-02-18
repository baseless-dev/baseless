import { importSPKI } from "https://deno.land/x/jose@v4.3.7/key/import.ts";
import { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
import { Command, Result } from "https://baseless.dev/x/shared/server.ts";
import { Auth } from "./auth.ts";

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

	public send(command: Command): Promise<Result> {
		return this._transport.send(this, command);
	}
}

export interface ITransport {
	send(app: App, command: Command): Promise<Result>;
}

export class FetchTransport implements ITransport {
	public constructor(
		public readonly baselessUrl: string,
	) {}

	async send(app: App, command: Command): Promise<Result> {
		const tokens = app.getAuth()?.getTokens();
		const clientId = app.getClientId();
		const request = new Request(this.baselessUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-BASELESS-CLIENT-ID": clientId,
				...(tokens?.access_token ? { "Authorization": `Bearer ${tokens.access_token}` } : {}),
			},
			body: JSON.stringify({ "1": command }),
		});
		const response = await fetch(request);
		const json = await response.json();
		return json["1"] as Result;
	}
}

export class MemoryStorage implements Storage {
	public constructor(
		protected store: Map<string, string> = new Map(),
	) {}

	get length(): number {
		return this.store.size;
	}

	clear(): void {
		this.store.clear();
	}

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	key(index: number): string | null {
		const keys = Array.from(this.store.keys());
		if (index >= keys.length) {
			return null;
		}
		return keys.at(index) ?? null;
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}
}

class PrefixedStorage implements Storage {
	public constructor(
		protected prefix: string,
		protected storage: Storage,
	) {}

	protected *keys(): Generator<string> {
		const l = this.storage.length;
		const p = `${this.prefix}_`;
		const pl = p.length;
		for (let i = 0; i < l; ++i) {
			const key = this.storage.key(i)!;
			if (key.substring(0, pl) === p) {
				yield key.substring(pl);
			}
		}
	}

	get length(): number {
		return Array.from(this.keys()).length;
	}

	clear(): void {
		const keys = Array.from(this.keys());
		for (const key of keys) {
			this.storage.removeItem(`${this.prefix}_${key}`);
		}
	}

	getItem(key: string): string | null {
		return this.storage.getItem(`${this.prefix}_${key}`) ?? null;
	}

	key(index: number): string | null {
		let i = 0;
		for (const key of this.keys()) {
			if (i++ === index) {
				return key;
			}
		}
		return null;
	}

	removeItem(key: string): void {
		this.storage.removeItem(`${this.prefix}_${key}`);
	}

	setItem(key: string, value: string): void {
		this.storage.setItem(`${this.prefix}_${key}`, value);
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
	const transport = new FetchTransport(baselessUrl);
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
