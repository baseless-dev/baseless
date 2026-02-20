import { Identity } from "./identity.ts";
import * as z from "./schema.ts";

export interface AuthenticationTokens {
	accessToken: string;
	idToken: string;
	refreshToken?: string;
}

export const AuthenticationTokens = z.strictObject({
	accessToken: z.string(),
	idToken: z.string(),
	refreshToken: z.optional(z.string()),
}).meta({ id: "AuthenticationTokens" });

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

	toJSON(): AuthenticationTokens {
		return this.tokens;
	}

	get tokens(): AuthenticationTokens {
		return this.#tokens;
	}

	get accessToken(): string {
		return this.#tokens.accessToken;
	}
	get idToken(): string {
		return this.#tokens.idToken;
	}
	get refreshToken(): string | undefined {
		return this.#tokens.refreshToken;
	}

	get identity(): Identity {
		return this.#identity;
	}

	get accessTokenExpiration(): number {
		return this.#accessTokenExpiration;
	}

	get refreshTokenExpiration(): number | undefined {
		return this.#refreshTokenExpiration;
	}

	get claims(): Readonly<Record<string, unknown>> {
		return { ...this.#claims };
	}
}
