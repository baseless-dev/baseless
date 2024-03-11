import type { IdentityProvider } from "../../providers/identity/provider.ts";

export class IdentityConfiguration {
	#identityProvider?: IdentityProvider;

	constructor(identityProvider?: IdentityProvider) {
		this.#identityProvider = identityProvider;
	}

	setIdentityProvider(
		identityProvider: IdentityProvider,
	): IdentityConfiguration {
		return new IdentityConfiguration(identityProvider);
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#identityProvider) {
			throw new Error("An identity provider must be provided.");
		}
		return Object.freeze({
			identityProvider: this.#identityProvider,
		});
	}
}
