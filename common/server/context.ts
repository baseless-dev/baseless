import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import type { IAssetService } from "./services/asset.ts";
import type { IAuthenticationService } from "./services/auth.ts";
import type { ICounterService } from "./services/counter.ts";
import type { IDocumentService } from "./services/document.ts";
import type { IIdentityService } from "./services/identity.ts";
import type { IKVService } from "./services/kv.ts";
import type { ISessionService } from "./services/session.ts";
import type { TokenData } from "./token_data.ts";
import type { AuthenticationCeremonyComponent } from "../auth/ceremony/ceremony.ts";
import type { AuthenticationComponent } from "../auth/component.ts";

export type AuthenticationKeys = {
	algo: string;
	privateKey: KeyLike;
	publicKey: KeyLike;
};

export type RateLimitConfiguration = {
	count: number;
	interval: number;
};

export type AuthenticationConfiguration = {
	keys: AuthenticationKeys;
	salt: string;
	ceremony: AuthenticationCeremonyComponent;
	components: AuthenticationComponent[];
	rateLimit: RateLimitConfiguration;
	accessTokenTTL: number;
	refreshTokenTTL: number;
	allowAnonymousIdentity: boolean;
	highRiskActionTimeWindow: number;
};

/**
 * Baseless's context
 */
export interface IContext {
	readonly authenticationToken: TokenData | undefined;
	readonly config: {
		auth?: AuthenticationConfiguration;
	};
	readonly asset: IAssetService;
	readonly counter: ICounterService;
	readonly kv: IKVService;
	readonly document: IDocumentService;
	readonly identity: IIdentityService;
	readonly session: ISessionService;
	readonly auth: IAuthenticationService;

	/**
	 * Extend the lifetime of the request until the promise is done without blocking the response
	 * @param promise The promise
	 */
	waitUntil(promise: PromiseLike<unknown>): void;
}
