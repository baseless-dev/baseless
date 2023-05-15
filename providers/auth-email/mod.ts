import { AuthenticationIdenticator, AuthenticationIdenticatorIdentifyOptions, AuthenticationIdenticatorSendMessageOptions } from "../../common/auth/identicator.ts";
import { MessageProvider } from "../message.ts";

export class EmailAuthentificationIdenticator
	extends AuthenticationIdenticator {
	#messageProvider: MessageProvider;
	constructor(messageProvider: MessageProvider) {
		super();
		this.#messageProvider = messageProvider;
	}

	sendMessage = async (
		{ message, identityIdentification }: AuthenticationIdenticatorSendMessageOptions
	): Promise<void> => {
		await this.#messageProvider.send({
			recipient: identityIdentification.identification,
			...message,
		});
	};

	// deno-lint-ignore require-await
	async identify(
		{ identityIdentification, identification }: AuthenticationIdenticatorIdentifyOptions
	): Promise<boolean> {
		return identityIdentification.identification === identification;
	}
}
