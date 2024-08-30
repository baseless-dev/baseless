import { IdentityComponentProvider } from "../../provider/identitycomponent.ts";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationComponentPrompt } from "../component.ts";
import { AuthenticationContext } from "../types.ts";
import { encodeBase64 } from "@std/encoding/base64";

export class PasswordIdentityComponentProvider implements IdentityComponentProvider {
	#salt: string;

	constructor(
		salt: string,
	) {
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

	getSignInPrompt(
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityComponent?: IdentityComponent;
		},
	): Promise<AuthenticationComponentPrompt> {
		return this.getSetupPrompt(options);
	}
	async verifySignInPrompt(
		options: {
			componentId: string;
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
		options: {
			componentId: string;
			context: AuthenticationContext;
			identityId?: Identity["identityId"];
		},
	): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: options.componentId,
			prompt: "password",
			options: {},
		});
	}
	async setupIdentityComponent(
		options: {
			componentId: string;
			context: AuthenticationContext;
			value: unknown;
		},
	): Promise<Omit<IdentityComponent, "identityId" | "componentId">> {
		const hash = await this.hashPassword(`${options.value}`);
		return Promise.resolve({
			data: { hash },
			confirmed: true,
		});
	}
}
