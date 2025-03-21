import { Identity } from "@baseless/core/identity";
import * as Type from "@baseless/core/schema";
import { AuthenticationTokens, InvalidAuthenticationTokens } from "@baseless/core/authentication-tokens";

export interface TokensMetadata {
	identity: Identity;
	accessTokenExpiration: number;
	refreshTokenExpiration?: number;
	tokens: AuthenticationTokens;
}

export class TokensManager {
	#identities: TokensMetadata[];

	constructor(tokens: AuthenticationTokens[] = []) {
		this.#identities = [];
		for (const t of tokens) {
			this.add(t);
		}
	}

	[Symbol.iterator](): IterableIterator<TokensMetadata> {
		return this.#identities.values();
	}

	add(tokens: AuthenticationTokens): TokensMetadata {
		try {
			Type.assert(AuthenticationTokens, tokens);
			const { exp: accessTokenExpiration } = JSON.parse(atob(tokens.accessToken.split(".").at(1)!));
			const { exp: refreshTokenExpiration } = tokens.refreshToken ? JSON.parse(atob(tokens.refreshToken.split(".").at(1)!)) : {};
			const { sub: id, claims = {} } = JSON.parse(atob(tokens.idToken.split(".").at(1)!));
			const identity = { id, data: claims };
			Type.assert(Identity, identity);
			const meta = { identity, accessTokenExpiration, refreshTokenExpiration, tokens };
			const idx = this.#identities.findIndex((i) => i.identity.id === identity.id);
			if (idx > -1) {
				this.#identities.splice(idx, 1, meta);
			} else {
				this.#identities.push(meta);
			}
			return meta;
		} catch (cause) {
			throw new InvalidAuthenticationTokens(undefined, { cause });
		}
	}

	remove(identityId: Identity["id"]): void {
		const idx = this.#identities.findIndex((i) => i.identity.id === identityId);
		if (idx > -1) {
			this.#identities.splice(idx, 1);
		}
	}

	getByIdentityId(identityId: Identity["id"]): TokensMetadata | undefined {
		return this.#identities.find((i) => i.identity.id === identityId);
	}

	getByIndex(index: number): TokensMetadata | undefined {
		return this.#identities[index];
	}
}
