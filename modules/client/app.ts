import { importSPKI } from "https://deno.land/x/jose@v4.3.7/key/import.ts";
import { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
import { Command, Result } from "https://baseless.dev/x/shared/server.ts";
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
		protected readonly clientId: string,
		protected readonly clientPublicKey: KeyLike,
		protected readonly transport: ITransport,
	) {}

	public getClientId() {
		return this.clientId;
	}

	public getClientPublicKey() {
		return this.clientPublicKey;
	}

	protected tokens: Tokens | undefined;

	public getTokens() {
		return this.tokens;
	}

	/**
	 * @internal
	 */
	public setTokens(tokens: Tokens | undefined) {
		this.tokens = tokens;
	}

	public send(command: Command): Promise<Result> {
		return this.transport.send(this, command);
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
		const tokens = app.getTokens();
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
	return new App(options.clientId, publicKey, options.transport);
}
