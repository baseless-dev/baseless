import {
	AuthenticationIdenticator,
	type AuthenticationIdenticatorIdentifyOptions,
	type AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";
import type { MessageProvider } from "../message.ts";

export default class EmailAuthentificationIdenticator
	extends AuthenticationIdenticator {
	#messageProvider: MessageProvider;
	constructor(
		messageProvider: MessageProvider,
	) {
		super();
		this.#messageProvider = messageProvider;
	}
	// deno-lint-ignore require-await
	async identify(
		{ identityIdentification, identification }:
			AuthenticationIdenticatorIdentifyOptions,
	): Promise<boolean | URL> {
		return identityIdentification.identification === identification;
	}
	async sendMessage(
		{ message, identityId }: AuthenticationIdenticatorSendMessageOptions,
	): Promise<void> {
		await this.#messageProvider.send({
			recipient: identityId,
			...message,
		});
	}
}
