import type { IdentityIdentification } from "../identity/identification.ts";
import { Message } from "../message/message.ts";
import { Context } from "../server/context.ts";
import { AuthenticationCeremonyComponentIdentification } from "./ceremony/component/identification.ts";

export type AuthenticationIdenticatorIdentifyOptions = {
	context: Context;
	identityIdentification: IdentityIdentification;
	identification: string;
}

export type AuthenticationIdenticatorSendMessageOptions = {
	context: Context;
	identityIdentification: IdentityIdentification;
	message: Omit<Message, "recipient">;
}

export abstract class AuthenticationIdenticator implements AuthenticationCeremonyComponentIdentification {
	abstract kind: string;
	abstract prompt: "email" | "action";
	abstract identify(options: AuthenticationIdenticatorIdentifyOptions): Promise<boolean | URL>;

	sendMessage?: (options: AuthenticationIdenticatorSendMessageOptions) => Promise<void> = undefined;

	rateLimit: { interval: number; count: number } = { interval: 0, count: 0 };
}
