import {
	AuthenticationIdenticator,
	type AuthenticationIdenticatorIdentifyOptions,
	type AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";
import { IdentityNotFoundError } from "../../common/identity/errors.ts";
import type { Identity } from "../../common/identity/identity.ts";

export default class OAuth2AuthentificationIdenticator
	extends AuthenticationIdenticator {
	#tokenUrl: URL;
	constructor(
		tokenUrl: string | URL,
	) {
		super();
		this.#tokenUrl = new URL(tokenUrl.toString());
	}
	async identify(
		{ type, identification, context }: AuthenticationIdenticatorIdentifyOptions,
	): Promise<Identity> {
		if (
			!identification || typeof identification !== "object" ||
			!("code" in identification && typeof identification.code === "string") ||
			!("redirect_url" in identification &&
				typeof identification.redirect_url === "string")
		) {
			throw new IdentityNotFoundError();
		}
		const { code, redirect_url } = identification;

		const url = new URL(this.#tokenUrl);
		const headers = new Headers({
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept": "application/json",
		});
		const body = new URLSearchParams();
		body.set("client_id", url.searchParams.get("client_id") ?? "");
		body.set("grant_type", "authorization_code");
		body.set("code", code);
		body.set("redirect_url", redirect_url);
		url.searchParams.delete("client_id");

		const response = await fetch(url, { method: "POST", headers, body });
		const data = await response.json();
		console.log(data);
		// const identity = await context.identity.getByIdentification(
		// 	type,
		// 	data.something_id_user,
		// );
		// return identity;
		throw new Error("Not implemented");
	}
	async sendMessage(
		_options: AuthenticationIdenticatorSendMessageOptions,
	): Promise<void> {}
}
