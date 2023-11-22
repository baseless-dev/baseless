import {
	AuthenticationIdenticator,
	type AuthenticationIdenticatorIdentifyOptions,
	type AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";
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
		const url = new URL(this.#tokenUrl);
		const headers = new Headers({
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept": "application/json",
		});
		const body = new URLSearchParams();
		body.set("client_id", url.searchParams.get("client_id") ?? "");
		body.set("grant_type", "authorization_code");
		body.set("code", identification);
		// body.set("redirect_url", "TODO");
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
