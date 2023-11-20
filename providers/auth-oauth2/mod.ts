import {
	AuthenticationIdenticator,
	type AuthenticationIdenticatorIdentifyOptions,
	type AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";

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
		_options: AuthenticationIdenticatorIdentifyOptions,
	): Promise<boolean | URL> {
		// https://github.com/pilcrowOnPaper/oslo/blob/8bdba7eb27e742e1fe1ace385bbfe1d69d33c027/src/oauth2/core.ts#L100-L140
		throw new Error("Not implemented");
	}
	async sendMessage(
		_options: AuthenticationIdenticatorSendMessageOptions,
	): Promise<void> {}
}
