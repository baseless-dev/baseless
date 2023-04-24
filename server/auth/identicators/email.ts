import { IdentityIdentification } from "../../providers/identity.ts";
import { MessageData, MessageProvider } from "../../providers/message.ts";
import { AuthenticationIdenticator } from "../config.ts";

export class EmailAuthentificationIdenticator extends AuthenticationIdenticator {
	#messageProvider: MessageProvider;
	constructor(messageProvider: MessageProvider) {
		super();
		this.#messageProvider = messageProvider;
	}

	async sendMessage(identification: IdentityIdentification, message: MessageData): Promise<void> {
		await this.#messageProvider.send({
			to: identification.identification,
			...message
		});
	}

	// deno-lint-ignore require-await
	async identify(
		identityIdentification: IdentityIdentification,
		identification: string,
	): Promise<boolean> {
		return identityIdentification.identification === identification;
	}
}
