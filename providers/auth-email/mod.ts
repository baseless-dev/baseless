import type { AuthenticationCeremonyComponent } from "../../common/auth/ceremony/ceremony.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentSendMessageOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../../common/auth/component.ts";
import type { IdentityComponent } from "../../common/identity/component.ts";
import { IdentityNotFoundError } from "../../common/identity/errors.ts";
import type { Identity } from "../../common/identity/identity.ts";
import type { IdentityProvider } from "../identity.ts";
import type { MessageProvider } from "../message.ts";

export default class EmailAuthentificationComponent
	extends AuthenticationComponent {
	#identityProvider: IdentityProvider;
	#messageProvider: MessageProvider;
	constructor(
		id: string,
		identityProvider: IdentityProvider,
		messageProvider: MessageProvider,
	) {
		super(id);
		this.#identityProvider = identityProvider;
		this.#messageProvider = messageProvider;
	}
	getCeremonyComponent(): AuthenticationCeremonyComponent {
		return {
			kind: "prompt",
			id: this.id,
			prompt: "email",
			options: {},
		};
	}
	// deno-lint-ignore require-await
	async getIdentityComponentMeta(
		{ value }: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Pick<IdentityComponent, "identification" | "meta">> {
		return { identification: `${value}`, meta: {} };
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
	async sendMessage(
		{ message, identity }: AuthenticationComponentSendMessageOptions,
	): Promise<void> {
		await this.#messageProvider.send({
			...message,
			recipient: identity.id,
		});
	}
}
