import type { KeyLike } from "npm:jose@5.2.0";
import type { AuthenticationProvider } from "../../providers/auth.ts";
import type { AuthenticationCeremonyComponent } from "../../lib/authentication/types.ts";

type Options = {
	keys?: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	authenticationProviders?: AuthenticationProvider[];
	ceremony?: AuthenticationCeremonyComponent;
	rateLimit?: {
		count: number;
		interval: number;
	};
	registrationTTL?: number;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
};

export class RegistrationConfiguration {
	#options?: Options;

	constructor(options?: Options) {
		this.#options = options;
	}

	setKeys(
		keys: {
			algo: string;
			privateKey: KeyLike;
			publicKey: KeyLike;
		},
	): RegistrationConfiguration {
		return new RegistrationConfiguration({
			...this.#options,
			keys,
		});
	}

	setAuthenticationProviders(
		authenticationProviders: AuthenticationProvider[],
	): RegistrationConfiguration {
		return new RegistrationConfiguration({
			...this.#options,
			authenticationProviders: [...authenticationProviders],
		});
	}

	setCeremony(
		ceremony: AuthenticationCeremonyComponent,
	): RegistrationConfiguration {
		return new RegistrationConfiguration({
			...this.#options,
			ceremony,
		});
	}

	setRateLimit(
		rateLimit: {
			count: number;
			interval: number;
		},
	): RegistrationConfiguration {
		return new RegistrationConfiguration({
			...this.#options,
			rateLimit,
		});
	}

	setRegistrationTTL(
		registrationTTL: number,
	): RegistrationConfiguration {
		return new RegistrationConfiguration({
			...this.#options,
			registrationTTL,
		});
	}

	setAccessTokenTTL(
		accessTokenTTL: number,
	): RegistrationConfiguration {
		return new RegistrationConfiguration({
			...this.#options,
			accessTokenTTL,
		});
	}

	setRefreshTokenTTL(
		refreshTokenTTL: number,
	): RegistrationConfiguration {
		return new RegistrationConfiguration({
			...this.#options,
			refreshTokenTTL,
		});
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#options?.keys) {
			throw new Error("Keys must be provided.");
		}
		if (!this.#options?.authenticationProviders) {
			throw new Error("Authentication providers must be provided.");
		}
		if (!this.#options?.ceremony) {
			throw new Error("A ceremony must be provided.");
		}
		return Object.freeze({
			keys: this.#options?.keys,
			authenticationProviders: this.#options?.authenticationProviders,
			ceremony: this.#options?.ceremony,
			rateLimit: Object.freeze(
				this.#options?.rateLimit ??
					{ count: 10, interval: 1000 * 60 * 2 },
			),
			registrationTTL: this.#options?.registrationTTL ?? 1000 * 60 * 15,
			accessTokenTTL: this.#options?.accessTokenTTL ?? 1000 * 60 * 15,
			refreshTokenTTL: this.#options?.refreshTokenTTL ??
				1000 * 60 * 60 * 24 * 7,
		});
	}
}
