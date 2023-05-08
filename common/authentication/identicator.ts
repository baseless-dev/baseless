import type { IdentityIdentification } from "../identity/identification.ts";
import { Message } from "../message/message.ts";

export abstract class AuthenticationIdenticator {
	abstract identify(
		identityIdentification: IdentityIdentification,
		identification: string,
	): Promise<boolean | URL>;

	sendMessage?: (
		identityIdentification: IdentityIdentification,
		message: Omit<Message, 'recipient'>,
	) => Promise<void> = undefined;

	sendInterval?: number = undefined;

	sendCount?: number = undefined;
}