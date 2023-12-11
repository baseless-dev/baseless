import type { IdentityComponent } from "../identity/component.ts";
import type { Identity } from "../identity/identity.ts";
import type { Message } from "../message/message.ts";
import type { IContext } from "../server/context.ts";
import type { AuthenticationCeremonyComponent } from "./ceremony/ceremony.ts";

export type AuthenticationComponentRateLimit = {
	readonly interval: number;
	readonly count: number;
};

export type AuthenticationComponentGetIdentityComponentIdentificationOptions = {
	context: IContext;
	value: unknown;
};

export type AuthenticationComponentGetIdentityComponentMetaOptions = {
	context: IContext;
	value: unknown;
};

export type AuthenticationComponentVerifyPromptOptions = {
	context: IContext;
	value: unknown;
	identity?: {
		identity: Identity;
		component: IdentityComponent;
	};
};

export type AuthenticationComponentSendPromptOptions = {
	context: IContext;
	locale: string;
	identity: Identity;
	identityComponent: IdentityComponent;
};

export type AuthenticationComponentSendMessageOptions = {
	context: IContext;
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
	getIdentityComponentIdentification?(
		options: AuthenticationComponentGetIdentityComponentIdentificationOptions,
	): Promise<string>;
	abstract getIdentityComponentMeta(
		options: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<IdentityComponent["meta"]>;
	abstract sendPrompt(
		options: AuthenticationComponentSendPromptOptions,
	): Promise<void>;
	abstract verifyPrompt(
		options: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity>;
	sendMessage?(
		options: AuthenticationComponentSendMessageOptions,
	): Promise<void>;
}
