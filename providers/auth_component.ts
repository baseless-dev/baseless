import type { AuthenticationCeremonyComponentPrompt } from "../lib/authentication/types.ts";
import type { Identity, IdentityComponent } from "../lib/identity/types.ts";

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
		id: Identity["id"];
		component: IdentityComponent;
	};
};

export type AuthenticationComponentSendPromptOptions = {
	locale: string;
	identity: {
		id: Identity["id"];
		component: IdentityComponent;
	};
};

export type AuthenticationComponentSendValidationOptions = {
	locale: string;
	identity: {
		id: Identity["id"];
		component: IdentityComponent;
	};
};

export type AuthenticationComponentValidateCodeOptions = {
	value: unknown;
	identity: {
		id: Identity["id"];
		component: IdentityComponent;
	};
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

	initializeIdentityComponent(
		_options: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Omit<IdentityComponent, "id">> {
		return Promise.resolve({ meta: {}, confirmed: true });
	}
	sendPrompt?(
		options: AuthenticationComponentSendPromptOptions,
	): Promise<void>;

	abstract verifyPrompt(
		options: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity>;

	sendValidationCode?(
		options: AuthenticationComponentSendValidationOptions,
	): Promise<void>;
	validationCodePrompt?(): AuthenticationCeremonyComponentPrompt;
	validateCode?(
		options: AuthenticationComponentValidateCodeOptions,
	): Promise<boolean | Identity>;
}
