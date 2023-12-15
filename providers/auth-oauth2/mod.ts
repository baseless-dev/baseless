import type { AuthenticationCeremonyComponent } from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../../common/auth/component.ts";
import type { IdentityComponent } from "../../common/identity/component.ts";
import { IdentityNotFoundError } from "../../common/identity/errors.ts";
import type { Identity } from "../../common/identity/identity.ts";

export default abstract class OAuth2AuthentificationComponent
	extends AuthenticationComponent {
	#authorizationUrl: URL;
	#tokenUrl: URL;
	#redirectUrl: URL;
	#clientId: string;
	#clientSecret: string;
	#scope?: string;

	constructor(
		id: string,
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
		this.#authorizationUrl = new URL(options.authorizationUrl.toString());
		this.#tokenUrl = new URL(options.tokenUrl.toString());
		this.#redirectUrl = new URL(options.redirectUrl.toString());
		this.#clientId = options.clientId;
		this.#clientSecret = options.clientSecret;
		this.#scope = options.scope;
	}

	getCeremonyComponent(): AuthenticationCeremonyComponent {
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
		return {
			kind: "prompt",
			id: this.id,
			prompt: "oauth2",
			options: {
				authorizationUrl: authorizationUrl.toString(),
			},
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
		{ context, value }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (
			!value || typeof value !== "object" ||
			!("code" in value && typeof value.code === "string")
		) {
			throw new IdentityNotFoundError();
		}
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
			const identity = await context.identity.getByIdentification(
				this.id,
				identification,
			);
			return identity;
		} catch (_error) {
			throw new IdentityNotFoundError();
		}
	}
}
