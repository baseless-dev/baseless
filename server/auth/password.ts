import type {
	AuthenticationComponentPrompt,
	Identity,
	IdentityChannel,
	IdentityComponent,
	IdentityComponentProvider,
	IdentityComponentProviderGetSetupPromptOptions,
	IdentityComponentProviderGetSignInPromptOptions,
	IdentityComponentProviderSetupIdentityComponentOptions,
	IdentityComponentProviderVerifySignInPromptOptions,
} from "../provider.ts";
import { encodeBase64 } from "@std/encoding/base64";

/**
 * {@link IdentityComponentProvider} that authenticates users via a
 * salted SHA-512 password hash.
 */
export class PasswordIdentityComponentProvider implements IdentityComponentProvider {
	#salt: string;

	constructor(salt: string) {
		this.#salt = salt;
	}

	/**
	 * Hashes a plain-text password using SHA-512 with the configured salt.
	 * @param password The plain-text password to hash.
	 * @returns A Base64-encoded SHA-512 hash string.
	 */
	async hashPassword(password: string): Promise<string> {
		return encodeBase64(
			await crypto.subtle.digest(
				"SHA-512",
				new TextEncoder().encode(`${this.#salt}:${password}`),
			),
		);
	}

	getSignInPrompt(options: IdentityComponentProviderGetSignInPromptOptions): Promise<AuthenticationComponentPrompt> {
		return this.getSetupPrompt(options);
	}

	async verifySignInPrompt(options: IdentityComponentProviderVerifySignInPromptOptions): Promise<boolean | Identity["id"]> {
		const hash = await this.hashPassword(`${options.value}`);
		return !!options.identityComponent && "hash" in options.identityComponent?.data &&
			options.identityComponent.data.hash === hash;
	}

	getSetupPrompt(options: IdentityComponentProviderGetSetupPromptOptions): Promise<AuthenticationComponentPrompt> {
		return Promise.resolve({
			kind: "component",
			id: options.componentId,
			prompt: "password",
			options: {},
			sendable: false,
		});
	}

	async setupIdentityComponent(
		options: IdentityComponentProviderSetupIdentityComponentOptions,
	): Promise<[Omit<IdentityComponent, "identityId" | "componentId">, ...Omit<IdentityComponent | IdentityChannel, "identityId">[]]> {
		const hash = await this.hashPassword(`${options.value}`);
		return Promise.resolve([{
			data: { hash },
			confirmed: true,
		}]);
	}
}
