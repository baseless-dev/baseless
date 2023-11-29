import type { IdentityIdentification } from "../identity/identification.ts";
import type { Identity } from "../identity/identity.ts";
import type { Message } from "../message/message.ts";
import type { IContext } from "../server/context.ts";
import type { AutoId } from "../system/autoid.ts";
import type { AuthenticationCeremonyComponentIdentification } from "./ceremony/ceremony.ts";

export type AuthenticationIdenticatorIdentifyOptions = {
	context: IContext;
	type: string;
	identification: unknown;
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
	#id: string;
	constructor(id: string) {
		this.#id = id;
	}
	get id(): string {
		return this.#id;
	}
	readonly rateLimit: AuthenticationIdenticatorRateLimitOptions = {
		count: 0,
		interval: 0,
	};
	abstract ceremonyComponent(): AuthenticationCeremonyComponentIdentification;
	abstract identify(
		options: AuthenticationIdenticatorIdentifyOptions,
	): Promise<Identity>;
	abstract sendMessage(
		options: AuthenticationIdenticatorSendMessageOptions,
	): Promise<void>;
}
