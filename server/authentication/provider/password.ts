import { IdentityComponentProvider } from "../provider.ts";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "../component.ts";
import { encodeBase64 } from "@std/encoding/base64";
import { AuthenticationContext } from "../application.ts";

export class PasswordIdentityComponentProvider extends IdentityComponentProvider {
	#salt: string;

	constructor(
		id: string,
		salt: string,
	) {
		super(id);
		this.#salt = salt;
	}

	async hashPassword(password: string): Promise<string> {
		return encodeBase64(
			await crypto.subtle.digest(
				"SHA-512",
				new TextEncoder().encode(`${this.#salt}:${password}`),
			),
		);
	}

	async buildIdentityComponent(
		options: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<Omit<IdentityComponent, "identityId" | "componentId">> {
		const hash = await this.hashPassword(`${options.value}`);
		return Promise.resolve({
			data: { hash },
			confirmed: true,
		});
	}
	getSignInPrompt(
		_options: { context: AuthenticationContext; identityId?: Identity["identityId"] },
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: this.id,
			prompt: "password",
			options: {},
		});
	}
	async verifySignInPrompt(
		options: {
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
			value: unknown;
		},
	): Promise<boolean | Identity["identityId"]> {
		const hash = await this.hashPassword(`${options.value}`);
		return !!options.identityComponent && "hash" in options.identityComponent?.data &&
			options.identityComponent.data.hash === hash;
	}
	getSetupPrompt(
		_options: { context: AuthenticationContext; identityId?: Identity["identityId"] },
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: this.id,
			prompt: "password",
			options: {},
		});
	}
}
