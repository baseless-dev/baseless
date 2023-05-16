import type { IdentityIdentification } from "../identity/identification.ts";
import { Message } from "../message/message.ts";
import { IContext } from "../server/context.ts";
import { AuthenticationCeremonyComponentIdentification } from "./ceremony/component/identification.ts";

export type AuthenticationIdenticatorIdentifyOptions = {
	context: IContext;
	identityIdentification: IdentityIdentification;
	identification: string;
};

export type AuthenticationIdenticatorSendMessageOptions = {
	context: IContext;
	identityIdentification: IdentityIdentification;
	message: Omit<Message, "recipient">;
};

export abstract class AuthenticationIdenticator
	implements AuthenticationCeremonyComponentIdentification {
	abstract kind: string;
	abstract prompt: "email" | "action";
	toJSON() {
		return {
			kind: this.kind,
			prompt: this.prompt,
		};
	}
	abstract identify(
		options: AuthenticationIdenticatorIdentifyOptions,
	): Promise<boolean | URL>;

	sendMessage?: (
		options: AuthenticationIdenticatorSendMessageOptions,
	) => Promise<void> = undefined;

	rateLimit: { interval: number; count: number } = { interval: 0, count: 0 };
}
