import { AuthenticationIdenticator } from "../../common/auth/identicator.ts";
import { IdentityIdentification } from "../../common/identity/identification.ts";
import { Message } from "../../common/message/message.ts";
import { MessageProvider } from "../message.ts";

export class EmailAuthentificationIdenticator
	extends AuthenticationIdenticator {
	#messageProvider: MessageProvider;
	constructor(messageProvider: MessageProvider) {
		super();
		this.#messageProvider = messageProvider;
	}

	sendMessage = async (
		identification: IdentityIdentification,
		message: Omit<Message, "recipient">,
	): Promise<void> => {
		await this.#messageProvider.send({
			recipient: identification.identification,
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
