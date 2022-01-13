import { User } from "./auth.ts";
import { importSPKI } from "https://deno.land/x/jose@v4.3.7/key/import.ts";
import { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";

/**
 * A BaselessApp holds the initialization information for a collection of services.
 */
export class App {
	/**
	 * Construct an `App` object
	 * @internal
	 */
	public constructor(
		public readonly baselessUrl: string,
		public readonly clientId: string,
		public readonly clientPublicKey: KeyLike,
	) {}

	protected _currentUser: User | undefined;
	public get currentUser() {
		return this._currentUser;
	}

	protected _currentTokens:
		| {
			id_token: string;
			access_token: string;
			refresh_token?: string;
		}
		| undefined;

	/**
	 * Get ID Token
	 * @internal
	 */
	public getIdToken() {
		return this._currentTokens?.id_token;
	}

	/**
	 * Get Access Token
	 * @internal
	 */
	public getAccessToken() {
		return this._currentTokens?.access_token;
	}

	/**
	 * Get Refresh Token
	 * @internal
	 */
	public getRefreshToken() {
		return this._currentTokens?.refresh_token;
	}

	/**
	 * Set current user
	 * @internal
	 */
	public setCurrentUser(user: User) {
		this._currentUser = user;
	}

	/**
	 * Set tokens
	 * @internal
	 */
	public setTokens(
		id_token: string,
		access_token: string,
		refresh_token?: string,
	) {
		this._currentTokens = { id_token, access_token, refresh_token };
	}

	/**
	 * Fetch the endpoint using current user and credentials
	 * @internal
	 */
	public async fetch() {}
}

/**
 * Creates and initializes a `BaselessApp`.
 */
export async function initializeApp(options: {
	baselessUrl: string;
	clientId: string;
	clientPublicKey: string;
	clientPublicKeyAlg: string;
}) {
	const publicKey = await importSPKI(
		options.clientPublicKey,
		options.clientPublicKeyAlg,
	);
	return new App(options.baselessUrl, options.clientId, publicKey);
}
