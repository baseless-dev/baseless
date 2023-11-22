import type { IdentityIdentification } from "../identity/identification.ts";
import type { Identity } from "../identity/identity.ts";
import type { Message } from "../message/message.ts";
import type { IContext } from "../server/context.ts";
import type { AutoId } from "../system/autoid.ts";

export type AuthenticationIdenticatorIdentifyOptions = {
	context: IContext;
	type: string;
	identification: string;
};

export type AuthenticationIdenticatorSendMessageOptions = {
	context: IContext;
	identityId: AutoId;
	identityIdentification: IdentityIdentification;
	message: Omit<Message, "recipient">;
};

export type AuthenticationIdenticatorRateLimitOptions = {
	readonly interval: number;
	readonly count: number;
};

export abstract class AuthenticationIdenticator {
	readonly rateLimit: AuthenticationIdenticatorRateLimitOptions = {
		count: 0,
		interval: 0,
	};
	abstract identify(
		options: AuthenticationIdenticatorIdentifyOptions,
	): Promise<Identity>;
	abstract sendMessage(
		options: AuthenticationIdenticatorSendMessageOptions,
	): Promise<void>;
}
