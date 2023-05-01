import { IdentityIdentification } from "../../server/providers/identity.ts";
import {
	MessageData,
	MessageProvider,
} from "../../server/providers/message.ts";
import { AuthenticationIdenticator } from "../../server/auth/config.ts";

export class EmailAuthentificationIdenticator
	extends AuthenticationIdenticator {
	#messageProvider: MessageProvider;
	constructor(messageProvider: MessageProvider) {
		super();
		this.#messageProvider = messageProvider;
	}

	sendMessage = async (
		identification: IdentityIdentification,
		message: MessageData,
	): Promise<void> => {
		await this.#messageProvider.send({
			to: identification.identification,
			...message,
		});
	};

	// deno-lint-ignore require-await
	async identify(
		identityIdentification: IdentityIdentification,
		identification: string,
	): Promise<boolean> {
		return identityIdentification.identification === identification;
	}
}
