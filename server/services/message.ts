import { MessageSendError } from "../../common/message/errors.ts";
import { Message, assertMessage } from "../../common/message/message.ts";
import { AutoId, assertAutoId } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { PromisedResult, err, ok, unwrap } from "../../common/system/result.ts";
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

	public async send(identityId: AutoId, message: Message): PromisedResult<void, MessageSendError> {
		try {
			assertAutoId(identityId);
			assertMessage(message);
			const identifications = unwrap(await this.#identityProvider.listIdentification(
				identityId,
			));
			const verifiedIdentifications = identifications.filter((i) => i.verified);
			const sendMessages = verifiedIdentifications.reduce(
				(messages, identification) => {
					const identicator = this.#configuration.auth.flow.identificators.get(
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
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to send message, got ${inner}`);
		}
		return err(new MessageSendError());
	}
}
