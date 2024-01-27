import { encodeBase64 } from "../../deps.ts";
import type { Identity, IdentityComponent } from "../../lib/identity.ts";
import {
	AuthenticationComponent,
	AuthenticationComponentGetIdentityComponentMetaOptions,
	AuthenticationComponentVerifyPromptOptions,
} from "../auth_component.ts";

export default class PasswordAuthentificationComponent
	extends AuthenticationComponent {
	prompt = "password" as const;
	options = {};
	#salt: string;
	constructor(id: string, salt: string) {
		super(id);
		this.#salt = salt;
	}
	async #hashPassword(password: string): Promise<string> {
		return encodeBase64(
			await crypto.subtle.digest(
				"SHA-512",
				new TextEncoder().encode(`${this.#salt}:${password}`),
			),
		);
	}
	async getIdentityComponentMeta(
		{ value }: AuthenticationComponentGetIdentityComponentMetaOptions,
	): Promise<Pick<IdentityComponent, "identification" | "meta">> {
		const hash = await this.#hashPassword(`${value}`);
		return { meta: { hash } };
	}
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
