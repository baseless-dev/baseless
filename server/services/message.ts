import { MessageSendError } from "../../common/message/errors.ts";
import { assertMessage, Message } from "../../common/message/message.ts";
import { assertAutoId, AutoId } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { IdentityProvider } from "../../providers/identity.ts";
import { MessageProvider } from "../../providers/message.ts";
import { Configuration } from "../config.ts";

export class MessageService {
	#logger = createLogger("message-service");
	#configuration: Configuration;
	#messageProvider: MessageProvider;
	#identityProvider: IdentityProvider;

	constructor(
		configuration: Configuration,
		messageProvider: MessageProvider,
		identityProvider: IdentityProvider,
	) {
		this.#configuration = configuration;
		this.#messageProvider = messageProvider;
		this.#identityProvider = identityProvider;
	}

	/**
	 * @throws {MessageSendError}
	 */
	public async send(
		identityId: AutoId,
		message: Message,
	): Promise<void> {
		try {
			assertAutoId(identityId);
			assertMessage(message);
			const identifications = await this.#identityProvider.listIdentification(
				identityId,
			);
			const verifiedIdentifications = identifications.filter((i) => i.verified);
			const sendMessages = verifiedIdentifications.reduce(
				(messages, identification) => {
					const identicator = this.#configuration.auth.ceremony.identificators
						.get(
							identification.type,
						);
					if (identicator && identicator.sendMessage) {
						messages.push(identicator.sendMessage(identification, message));
					}
					return messages;
				},
				[] as Promise<void>[],
			);
			await Promise.allSettled(sendMessages);
		} catch (inner) {
			this.#logger.error(`Failed to send message, got ${inner}`);
		}
		throw new MessageSendError();
	}
}
