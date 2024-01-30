import type { AuthenticationCeremonyComponentPrompt } from "../lib/auth/types.ts";
import type { Identity, IdentityComponent } from "../lib/identity/types.ts";
import type { Message } from "../lib/message/types.ts";

// deno-lint-ignore no-empty-interface
interface IAuthenticationComponent
	extends AuthenticationCeremonyComponentPrompt {
}

export type AuthenticationComponentRateLimit = {
	interval: number;
	count: number;
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

export abstract class AuthenticationComponent
	implements IAuthenticationComponent {
	kind = "prompt" as const;
	id: string;
	abstract prompt: "email" | "oauth2" | "password" | "otp" | "totp";
	abstract options: Record<string, unknown>;
	#rateLimit: AuthenticationComponentRateLimit;

	get rateLimit(): AuthenticationComponentRateLimit {
		return { ...this.#rateLimit };
	}

	constructor(
		id: string,
		rateLimit: AuthenticationComponentRateLimit = {
			count: 10,
			interval: 60 * 5,
		},
	) {
		this.id = id;
		this.#rateLimit = rateLimit;
	}

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
