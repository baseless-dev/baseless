import type { IdentityComponent } from "../identity/component.ts";
import type { Identity } from "../identity/identity.ts";
import type { Message } from "../message/message.ts";
import type { AuthenticationCeremonyComponent } from "./ceremony/ceremony.ts";

export type AuthenticationComponentRateLimit = {
	readonly interval: number;
	readonly count: number;
};

export type AuthenticationComponentGetIdentityComponentMetaOptions = {
	value: unknown;
};

export type AuthenticationComponentVerifyPromptOptions = {
	value: unknown;
	identity?: {
		identity: Identity;
		component: IdentityComponent;
	};
};

export type AuthenticationComponentSendPromptOptions = {
	locale: string;
	identity: Identity;
	identityComponent: IdentityComponent;
};

export type AuthenticationComponentSendMessageOptions = {
	identity: Identity;
	identityComponent: IdentityComponent;
	message: Omit<Message, "recipient">;
};

export abstract class AuthenticationComponent {
	readonly id: string;
	readonly rateLimit: AuthenticationComponentRateLimit = {
		count: 10,
		interval: 60 * 5,
	};

	constructor(id: string) {
		this.id = id;
	}

	abstract getCeremonyComponent(): AuthenticationCeremonyComponent;
	getIdentityComponentMeta?(
		options: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Pick<IdentityComponent, "identification" | "meta">>;
	sendPrompt?(
		options: AuthenticationComponentSendPromptOptions,
	): Promise<void>;
	abstract verifyPrompt(
		options: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity>;
	sendMessage?(
		options: AuthenticationComponentSendMessageOptions,
	): Promise<void>;
}
