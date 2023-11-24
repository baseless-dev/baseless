import {
	AuthenticationIdenticator,
	type AuthenticationIdenticatorIdentifyOptions,
	type AuthenticationIdenticatorSendMessageOptions,
} from "../../common/auth/identicator.ts";
import { IdentityNotFoundError } from "../../common/identity/errors.ts";
import type { Identity } from "../../common/identity/identity.ts";
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
	async identify(
		{ type, identification, context }: AuthenticationIdenticatorIdentifyOptions,
	): Promise<Identity> {
		if (typeof identification !== "string") {
			throw new IdentityNotFoundError();
		}
		const identity = await context.identity.getByIdentification(
			type,
			identification,
		);
		const identityIdentification = identity.identifications[type];
		if (identityIdentification.identification !== identification) {
			throw new IdentityNotFoundError();
		}
		return identity;
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
