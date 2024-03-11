import type { KeyLike } from "npm:jose@5.2.0";
import type { AuthenticationProvider } from "../../providers/auth/provider.ts";
import type { AuthenticationCeremonyComponent } from "../../lib/authentication/types.ts";

type Options = {
	keys?: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	salt?: string;
	authenticationProviders?: AuthenticationProvider[];
	authenticationCeremony?: AuthenticationCeremonyComponent;
	registrationCeremony?: AuthenticationCeremonyComponent;
	rateLimit?: {
		count: number;
		interval: number;
	};
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	allowAnonymousIdentity?: boolean;
	highRiskActionTimeWindow?: number;
};

export class AuthenticationConfiguration {
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
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			keys,
		});
	}

	setSalt(
		salt: string,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			salt,
		});
	}

	setAuthenticationProviders(
		authenticationProviders: AuthenticationProvider[],
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			authenticationProviders: [...authenticationProviders],
		});
	}

	setAuthenticationCeremony(
		authenticationCeremony: AuthenticationCeremonyComponent,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			authenticationCeremony,
		});
	}

	setRegistrationCeremony(
		registrationCeremony: AuthenticationCeremonyComponent,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			registrationCeremony,
		});
	}

	setRateLimit(
		rateLimit: {
			count: number;
			interval: number;
		},
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			rateLimit,
		});
	}

	setAccessTokenTTL(
		accessTokenTTL: number,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			accessTokenTTL,
		});
	}

	setRefreshTokenTTL(
		refreshTokenTTL: number,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			refreshTokenTTL,
		});
	}

	setAllowAnonymousIdentity(
		allowAnonymousIdentity: boolean,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			allowAnonymousIdentity,
		});
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#options?.keys) {
			throw new Error("Keys must be provided.");
		}
		if (!this.#options?.salt) {
			throw new Error("Salt must be provided.");
		}
		if (!this.#options?.authenticationProviders) {
			throw new Error("Authentication providers must be provided.");
		}
		if (!this.#options?.authenticationCeremony) {
			throw new Error("An authentication ceremony must be provided.");
		}
		return Object.freeze({
			keys: this.#options?.keys,
			salt: this.#options?.salt,
			authenticationProviders: this.#options?.authenticationProviders,
			authenticationCeremony: this.#options?.authenticationCeremony,
			registrationCeremony: this.#options?.registrationCeremony ??
				this.#options?.authenticationCeremony,
			rateLimit: Object.freeze(
				this.#options?.rateLimit ??
					{ count: 10, interval: 1000 * 60 * 2 },
			),
			accessTokenTTL: this.#options?.accessTokenTTL ?? 1000 * 60 * 15,
			refreshTokenTTL: this.#options?.refreshTokenTTL ??
				1000 * 60 * 60 * 24 * 7,
			allowAnonymousIdentity: this.#options?.allowAnonymousIdentity ?? false,
			highRiskActionTimeWindow: this.#options?.highRiskActionTimeWindow ??
				1000 * 60 * 5,
		});
	}
}
