import type { AuthenticationCeremonyComponentPrompt } from "../../lib/auth/types.ts";
import { IdentityNotFoundError } from "../../lib/identity/errors.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { otp } from "../../lib/otp.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentSendValidationOptions,
	AuthenticationComponentValidateCodeOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../auth_component.ts";
import type { IdentityProvider } from "../identity.ts";
import type { KVProvider } from "../kv.ts";
import type { MessageProvider } from "../message.ts";

export default class EmailAuthentificationComponent
	extends AuthenticationComponent {
	prompt = "email" as const;
	options = {};
	#identityProvider: IdentityProvider;
	#kvProvider: KVProvider;
	#messageProvider: MessageProvider;
	constructor(
		id: string,
		identityProvider: IdentityProvider,
		kvProvider: KVProvider,
		messageProvider: MessageProvider,
	) {
		super(id);
		this.#identityProvider = identityProvider;
		this.#kvProvider = kvProvider;
		this.#messageProvider = messageProvider;
	}
	// deno-lint-ignore require-await
	async initializeIdentityComponent(
		{ value }: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Omit<IdentityComponent, "id">> {
		return { identification: `${value}`, meta: {}, confirmed: false };
	}
	async verifyPrompt(
		{ value }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (typeof value !== "string") {
			throw new IdentityNotFoundError();
		}
		const identity = await this.#identityProvider.getByIdentification(
			this.id,
			value,
		);
		return identity;
	}
	async sendValidationCode(
		{ identity }: AuthenticationComponentSendValidationOptions,
	): Promise<void> {
		const code = otp({ digits: 8 });
		await this.#kvProvider.put(["email-validation-code", identity.id], code, {
			expiration: 60 * 1000 * 5,
		});
		// TODO template?
		this.#messageProvider.send({
			recipient: identity.id,
			text: `Your validation code is ${code}`,
		});
	}
	async validateCode(
		{ identity, value }: AuthenticationComponentValidateCodeOptions,
	): Promise<boolean> {
		const code = await this.#kvProvider.get(
			["email-validation-code", identity.id],
		);
		return code.value === `${value}`;
	}
	validationCodePrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: "validation",
			kind: "prompt",
			prompt: "otp",
			options: {
				digits: 8,
				timeout: 60 * 1000 * 5,
			},
		};
	}
}
