import { assertAutoId, AutoId } from "../../shared/autoid.ts";
import { Configuration } from "../config.ts";
import {
	assertMessageData,
	MessageData,
	MessageProvider,
} from "../providers/message.ts";
import { IdentityProvider } from "./identity.ts";

export class MessageService {
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

	public async send(identityId: AutoId, message: MessageData): Promise<void> {
		assertAutoId(identityId);
		assertMessageData(message);
		const identifications = await this.#identityProvider.listIdentification(
			identityId,
		);
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
	}
}
