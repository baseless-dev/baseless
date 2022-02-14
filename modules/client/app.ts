import { importSPKI } from "https://deno.land/x/jose@v4.3.7/key/import.ts";
import { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
import { Tokens } from "./auth.ts";

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

	/**
	 * Retrieve tokens
	 * @internal
	 */
	public _tokens:
		| Tokens
		| undefined;

	/**
	 * Prepare a new `Request` object to the baseless enpoint with clientid and access token
	 */
	public prepareRequest() {
		return new Request(this.baselessUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-BASELESS-CLIENT-ID": this.clientId,
				...(this._tokens?.access_token ? { "Authorization": `Bearer ${this._tokens.access_token}` } : {}),
			},
		});
	}
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
