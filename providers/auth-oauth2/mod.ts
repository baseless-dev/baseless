import {
	type Identity,
	type IdentityComponent,
	IdentityNotFoundError,
} from "../../lib/identity.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../auth_component.ts";
import type { IdentityProvider } from "../identity.ts";

export default abstract class OAuth2AuthentificationComponent
	extends AuthenticationComponent {
	prompt = "oauth2" as const;
	options: { authorizationUrl: string };
	#identityProvider: IdentityProvider;
	#authorizationUrl: URL;
	#tokenUrl: URL;
	#redirectUrl: URL;
	#clientId: string;
	#clientSecret: string;
	#scope?: string;

	constructor(
		id: string,
		identityProvider: IdentityProvider,
		options: {
			authorizationUrl: string | URL;
			tokenUrl: string | URL;
			redirectUrl: string | URL;
			clientId: string;
			clientSecret: string;
			scope?: string;
		},
	) {
		super(id);
		this.#identityProvider = identityProvider;
		this.#authorizationUrl = new URL(options.authorizationUrl.toString());
		this.#tokenUrl = new URL(options.tokenUrl.toString());
		this.#redirectUrl = new URL(options.redirectUrl.toString());
		this.#clientId = options.clientId;
		this.#clientSecret = options.clientSecret;
		this.#scope = options.scope;

		const authorizationUrl = new URL(this.#authorizationUrl);
		authorizationUrl.searchParams.set("response_type", "code");
		authorizationUrl.searchParams.set("client_id", this.#clientId);
		if (this.#scope) {
			authorizationUrl.searchParams.set("scope", this.#scope);
		}
		authorizationUrl.searchParams.set(
			"redirect_uri",
			this.#redirectUrl.toString(),
		);
		this.options = {
			authorizationUrl: authorizationUrl.toString(),
		};
	}

	// deno-lint-ignore require-await
	async getIdentityComponentMeta(
		{ value }: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Pick<IdentityComponent, "identification" | "meta">> {
		return { identification: `${value}`, meta: {} };
	}
	abstract retrieveIdentification(access_token: string): Promise<string>;
	async verifyPrompt(
		{ value }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (
			value && typeof value === "object" && "code" in value &&
			typeof value.code === "string"
		) {
			const { code } = value;

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
			body.set("redirect_uri", this.#redirectUrl.toString());

			const response = await fetch(url, { method: "POST", headers, body });
			// deno-lint-ignore no-explicit-any
			const { access_token } = await response.json() as any;
			try {
				const identification = await this.retrieveIdentification(access_token);
				const identity = await this.#identityProvider.getByIdentification(
					this.id,
					identification,
				);
				return identity;
			} catch (_error) {
				//
			}
		}
		throw new IdentityNotFoundError();
	}
}
