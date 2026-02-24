import { Identity } from "./identity.ts";
import * as z from "./schema.ts";

/**
 * Raw JWT token strings returned on successful authentication.
 * The optional `refreshToken` is present only when the server issues
 * long-lived sessions.
 */
export interface AuthenticationTokens {
	accessToken: string;
	idToken: string;
	refreshToken?: string;
}

/** Zod schema for {@link AuthenticationTokens}. */
export const AuthenticationTokens = z.strictObject({
	accessToken: z.string(),
	idToken: z.string(),
	refreshToken: z.optional(z.string()),
}).meta({ id: "AuthenticationTokens" });

/**
 * Parsed wrapper around a set of {@link AuthenticationTokens}.
 * Decodes the JWT payloads to expose the user's {@link Identity}, expiration
 * timestamps, and arbitrary claims without requiring an additional round-trip.
 *
 * @example
 * ```ts
 * const obj = new AuthenticationTokensObject(tokens);
 * console.log(obj.identity.id); // "id_..."
 * console.log(obj.accessTokenExpiration); // Unix seconds
 * ```
 */
export class AuthenticationTokensObject {
	#tokens: AuthenticationTokens;
	#identity: Identity;
	#accessTokenExpiration: number;
	#refreshTokenExpiration?: number;
	#claims: Record<string, unknown>;

	constructor(tokens: AuthenticationTokens) {
		this.#tokens = tokens;
		try {
			z.assert(AuthenticationTokens, tokens);
			const { exp: accessTokenExpiration } = JSON.parse(atob(tokens.accessToken.split(".").at(1)!));
			const { exp: refreshTokenExpiration } = tokens.refreshToken ? JSON.parse(atob(tokens.refreshToken.split(".").at(1)!)) : {};
			const { sub: id, claims = {} } = JSON.parse(atob(tokens.idToken.split(".").at(1)!));
			const identity = { id, data: claims };
			z.assert(Identity, identity);

			this.#identity = identity;
			this.#accessTokenExpiration = parseInt(accessTokenExpiration) || 0;
			this.#refreshTokenExpiration = parseInt(refreshTokenExpiration) || undefined;
			this.#claims = { ...claims };
		} catch (_cause) {
			throw new Error("Invalid authentication tokens");
		}
	}

	/**
	 * Serializes back to the raw {@link AuthenticationTokens} object.
	 * @returns The underlying raw tokens.
	 */
	toJSON(): AuthenticationTokens {
		return this.tokens;
	}

	/** The raw {@link AuthenticationTokens} strings. */
	get tokens(): AuthenticationTokens {
		return this.#tokens;
	}

	/** The raw JWT access token string. */
	get accessToken(): string {
		return this.#tokens.accessToken;
	}
	/** The raw JWT ID token string. */
	get idToken(): string {
		return this.#tokens.idToken;
	}
	/** The raw JWT refresh token string, or `undefined` if not issued. */
	get refreshToken(): string | undefined {
		return this.#tokens.refreshToken;
	}

	/** The {@link Identity} decoded from the ID token payload. */
	get identity(): Identity {
		return this.#identity;
	}

	/** Unix timestamp (seconds) at which the access token expires. */
	get accessTokenExpiration(): number {
		return this.#accessTokenExpiration;
	}

	/** Unix timestamp (seconds) at which the refresh token expires, or `undefined` when no refresh token was issued. */
	get refreshTokenExpiration(): number | undefined {
		return this.#refreshTokenExpiration;
	}

	/** A read-only copy of the custom claims from the ID token payload. */
	get claims(): Readonly<Record<string, unknown>> {
		return { ...this.#claims };
	}
}
