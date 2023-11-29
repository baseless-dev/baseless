import type { AuthenticationCeremonyComponentIdentification } from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationIdenticator,
	type AuthenticationIdenticatorIdentifyOptions,
	type AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";
import { IdentityNotFoundError } from "../../common/identity/errors.ts";
import type { Identity } from "../../common/identity/identity.ts";

export default abstract class OAuth2AuthentificationIdenticator
	extends AuthenticationIdenticator {
	#authorizationUrl: URL;
	#tokenUrl: URL;
	#clientId: string;
	#clientSecret: string;
	#scope?: string;
	constructor(
		id: string,
		options: {
			authorizationUrl: string | URL;
			tokenUrl: string | URL;
			clientId: string;
			clientSecret: string;
			scope?: string;
		},
	) {
		super(id);
		this.#authorizationUrl = new URL(options.authorizationUrl.toString());
		this.#tokenUrl = new URL(options.tokenUrl.toString());
		this.#clientId = options.clientId;
		this.#clientSecret = options.clientSecret;
		this.#scope = options.scope;
	}
	ceremonyComponent(): AuthenticationCeremonyComponentIdentification {
		const authorizationUrl = new URL(this.#authorizationUrl);
		authorizationUrl.searchParams.set("response_type", "code");
		authorizationUrl.searchParams.set("client_id", this.#clientId);
		authorizationUrl.searchParams.set("scope", this.#scope ?? "");
		return {
			id: this.id,
			kind: "identification",
			prompt: "oauth2",
			authorizationUrl: authorizationUrl.toString(),
		};
	}
	abstract retrieveIdentification(access_token: string): Promise<string>;

	async identify(
		{ type, identification, context }: AuthenticationIdenticatorIdentifyOptions,
	): Promise<Identity> {
		if (
			!identification || typeof identification !== "object" ||
			!("code" in identification && typeof identification.code === "string") ||
			!("redirect_uri" in identification &&
				typeof identification.redirect_uri === "string") ||
			!("state" in identification && typeof identification.state === "string")
		) {
			throw new IdentityNotFoundError();
		}
		const { code, redirect_uri, state } = identification;

		const url = new URL(this.#tokenUrl);
		const headers = new Headers({
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept": "application/json",
			"Authorization": `Basic ${
				btoa(`${this.#clientId}:${this.#clientSecret}`)
			}`,
		});
		const body = new URLSearchParams();
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		body.set("redirect_uri", redirect_uri);

		const response = await fetch(url, { method: "POST", headers, body });
		const { access_token } = await response.json() as any;
		try {
			const id = await this.retrieveIdentification(access_token);
			const identity = await context.identity.getByIdentification(
				type,
				id,
			);
			return identity;
		} catch (_error) {
			throw new IdentityNotFoundError();
		}
	}
	async sendMessage(
		_options: AuthenticationIdenticatorSendMessageOptions,
	): Promise<void> {}
}
