import { encodeBase64 } from "https://deno.land/std@0.213.0/encoding/base64.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../../lib/authentication/types.ts";
import type { Identity, IdentityComponent } from "../../lib/identity/types.ts";
import { AuthenticationProvider } from "../auth.ts";

export default class PasswordAuthenticationProvider
	extends AuthenticationProvider {
	#salt: string;

	constructor(
		id: string,
		salt: string,
	) {
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

	async configureIdentityComponent(
		value: unknown,
	): Promise<Omit<IdentityComponent, "id">> {
		const hash = await this.#hashPassword(`${value}`);
		return { meta: { hash }, confirmed: true };
	}

	signInPrompt(): AuthenticationCeremonyComponentPrompt {
		return {
			id: this.id,
			kind: "prompt",
			prompt: "password",
			options: {},
		};
	}

	async verifySignInPrompt(
		{ value, identityComponent }: {
			value: unknown;
			identityId?: Identity["id"];
			identityComponent?: IdentityComponent;
		},
	): Promise<boolean | Identity> {
		if (!identityComponent) {
			return false;
		}
		const hash = await this.#hashPassword(`${value}`);
		return "hash" in identityComponent.meta &&
			identityComponent.meta.hash === hash;
	}

	setupPrompt(): undefined | AuthenticationCeremonyComponentPrompt {
		return this.signInPrompt();
	}
}
