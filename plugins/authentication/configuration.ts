import type { KeyLike } from "npm:jose@5.2.0";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { SessionProvider } from "../../providers/session.ts";
import type { AuthenticationProvider } from "../../providers/auth.ts";
import type { AuthenticationCeremonyComponent } from "../../lib/authentication/types.ts";

type Options = {
	identityProvider?: IdentityProvider;
	sessionProvider?: SessionProvider;
	keys?: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	salt?: string;
	authenticationProviders?: AuthenticationProvider[];
	ceremony?: AuthenticationCeremonyComponent;
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

	setIdentityProvider(
		identityProvider: IdentityProvider,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			identityProvider,
		});
	}

	setSessionProvider(
		sessionProvider: SessionProvider,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			sessionProvider,
		});
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

	setCeremony(
		ceremony: AuthenticationCeremonyComponent,
	): AuthenticationConfiguration {
		return new AuthenticationConfiguration({
			...this.#options,
			ceremony,
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
		if (!this.#options?.identityProvider) {
			throw new Error("An identity provider must be provided.");
		}
		if (!this.#options?.sessionProvider) {
			throw new Error("A session provider must be provided.");
		}
		if (!this.#options?.keys) {
			throw new Error("Keys must be provided.");
		}
		if (!this.#options?.salt) {
			throw new Error("Salt must be provided.");
		}
		if (!this.#options?.authenticationProviders) {
			throw new Error("Authentication providers must be provided.");
		}
		if (!this.#options?.ceremony) {
			throw new Error("A ceremony must be provided.");
		}
		return Object.freeze({
			identityProvider: this.#options?.identityProvider,
			sessionProvider: this.#options?.sessionProvider,
			keys: this.#options?.keys,
			salt: this.#options?.salt,
			authenticationProviders: this.#options?.authenticationProviders,
			ceremony: this.#options?.ceremony,
			rateLimit: this.#options?.rateLimit ??
				{ count: 10, interval: 1000 * 60 * 2 },
			accessTokenTTL: this.#options?.accessTokenTTL ?? 1000 * 60 * 15,
			refreshTokenTTL: this.#options?.refreshTokenTTL ??
				1000 * 60 * 60 * 24 * 7,
			allowAnonymousIdentity: this.#options?.allowAnonymousIdentity ?? false,
			highRiskActionTimeWindow: this.#options?.highRiskActionTimeWindow ??
				1000 * 60 * 5,
		});
	}
}
