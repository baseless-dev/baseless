import {
	type Identity,
	type IdentityComponent,
	IdentityNotFoundError,
} from "../../lib/identity.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentSendMessageOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../auth_component.ts";
import type { IdentityProvider } from "../identity.ts";
import type { MessageProvider } from "../message.ts";

export default class EmailAuthentificationComponent
	extends AuthenticationComponent {
	prompt = "email" as const;
	options = {};
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
