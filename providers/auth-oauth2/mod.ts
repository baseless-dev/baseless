import type { AuthenticationCeremonyComponentPrompt } from "../../lib/authentication/types.ts";
import { IdentityNotFoundError } from "../../lib/identity/errors.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { AuthenticationProvider } from "../auth.ts";
import type { IdentityProvider } from "../identity.ts";

export type OAuth2Options = {
	authorizationUrl: URL;
	tokenUrl: URL;
	redirectUrl: URL;
	clientId: string;
	clientSecret: string;
	scope?: string;
};

export default abstract class OAuth2AuthenticationProvider
	extends AuthenticationProvider {
	#identityProvider: IdentityProvider;
	#oauth2Options: OAuth2Options;

	constructor(
		id: string,
		identityProvider: IdentityProvider,
		options: OAuth2Options,
	) {
		super(id);
		this.#identityProvider = identityProvider;
		this.#oauth2Options = options;
	}

	abstract retrieveIdentification(access_token: string): Promise<string>;

	configureIdentityComponent(
		value: unknown,
	): Promise<Omit<IdentityComponent, "id">> {
		return Promise.resolve({
			identification: `${value}`,
			meta: {},
			confirmed: true,
		});
	}

	signInPrompt(): AuthenticationCeremonyComponentPrompt {
		const authorizationUrl = new URL(this.#oauth2Options.authorizationUrl);
		authorizationUrl.searchParams.set("response_type", "code");
		authorizationUrl.searchParams.set(
			"client_id",
			this.#oauth2Options.clientId,
		);
		if (this.#oauth2Options.scope) {
			authorizationUrl.searchParams.set("scope", this.#oauth2Options.scope);
		}
		authorizationUrl.searchParams.set(
			"redirect_uri",
			this.#oauth2Options.redirectUrl.toString(),
		);
		return {
			id: this.id,
			kind: "prompt",
			prompt: "oauth2",
			options: {
				authorizationUrl: authorizationUrl.toString(),
				redirectUrl: this.#oauth2Options.redirectUrl.toString(),
			},
		};
	}

	async verifySignInPrompt(
		{ value }: {
			value: unknown;
			identityId?: Identity["id"];
			identityComponent?: IdentityComponent;
		},
	): Promise<boolean | Identity> {
		if (
			value && typeof value === "object" && "code" in value &&
			typeof value.code === "string"
		) {
			const { code } = value;

			const url = new URL(this.#oauth2Options.tokenUrl);
			const headers = new Headers({
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json",
				"Authorization": `Basic ${
					btoa(
						`${this.#oauth2Options.clientId}:${this.#oauth2Options.clientSecret}`,
					)
				}`,
			});
			const body = new URLSearchParams();
			body.set("grant_type", "authorization_code");
			body.set("code", code);
			body.set("redirect_uri", this.#oauth2Options.redirectUrl.toString());

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

	setupPrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "oauth2",
			options: {},
		};
	}

	validationPrompt(): undefined | AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "otp",
			options: {
				digits: 8,
			},
		};
	}
}
