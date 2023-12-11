import { encode } from "../../common/encoding/base64.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentSendPromptOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../../common/auth/component.ts";
import type { AuthenticationCeremonyComponent } from "../../common/auth/ceremony/ceremony.ts";
import type { Identity } from "../../common/identity/identity.ts";

export default class PasswordAuthentificationComponent
	extends AuthenticationComponent {
	#salt: string;
	constructor(id: string, salt: string) {
		super(id);
		this.#salt = salt;
	}
	async #hashPassword(password: string): Promise<string> {
		return encode(
			await crypto.subtle.digest(
				"SHA-512",
				new TextEncoder().encode(`${this.#salt}:${password}`),
			),
		);
	}
	getCeremonyComponent(): AuthenticationCeremonyComponent {
		return {
			kind: "prompt",
			id: this.id,
			prompt: "password",
			options: {},
		};
	}
	async getIdentityComponentMeta(
		{ value }: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Record<string, unknown>> {
		const hash = await this.#hashPassword(`${value}`);
		return { hash };
	}
	async sendPrompt(
		_options: AuthenticationComponentSendPromptOptions,
	): Promise<void> {}
	async verifyPrompt(
		{ value, identity }: AuthenticationComponentVerifyPromptOptions,
	): Promise<boolean | Identity> {
		if (!identity) {
			return false;
		}
		const hash = await this.#hashPassword(`${value}`);
		return "hash" in identity.component.meta &&
			identity.component.meta.hash === hash;
	}
}
