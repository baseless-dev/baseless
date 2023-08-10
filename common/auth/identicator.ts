import type { IdentityIdentification } from "../identity/identification.ts";
import type { Message } from "../message/message.ts";
import type { IContext } from "../server/context.ts";
import type { AuthenticationCeremonyComponentIdentification } from "./ceremony/ceremony.ts";

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
	kind = "identification" as const;
	abstract id: string;
	abstract prompt: "email" | "action";
	toJSON(): Record<string, unknown> {
		return {
			kind: "identification",
			id: this.id,
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
