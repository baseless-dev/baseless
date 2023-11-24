import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import {
	assertAuthenticationCeremonyComponent,
	type AuthenticationCeremonyComponent,
} from "../../auth/ceremony/ceremony.ts";
import type { AuthenticationChallenger } from "../../auth/challenger.ts";
import type { AuthenticationIdenticator } from "../../auth/identicator.ts";
import type { ID } from "../../identity/identity.ts";
import type { IContext } from "../context.ts";
import { extract } from "../../auth/ceremony/component/extract.ts";
import { simplify } from "../../auth/ceremony/component/simplify.ts";
import { sequence } from "../../auth/ceremony/component/helpers.ts";

export type AuthenticationKeys = {
	readonly algo: string;
	readonly privateKey: KeyLike;
	readonly publicKey: KeyLike;
};

export type AuthenticationConfiguration = {
	readonly enabled: boolean;
	readonly security: {
		readonly keys: AuthenticationKeys;
		readonly salt: string;
		readonly rateLimit: {
			readonly identificationCount: number;
			readonly identificationInterval: number;
			readonly challengeCount: number;
			readonly challengeInterval: number;
			readonly confirmVerificationCodeCount: number;
			readonly confirmVerificationCodeInterval: number;
		};
	};
	readonly expirations: {
		readonly accessToken: number;
		readonly refreshToken: number;
	};
	readonly allowAnonymousIdentity: boolean;
	readonly ceremony: AuthenticationCeremonyComponent;
	readonly identificators: Map<string, AuthenticationIdenticator>;
	readonly challengers: Map<string, AuthenticationChallenger>;
	readonly highRiskActionTimeWindow: number;
	readonly onCreateIdentity?: AuthenticationHandler;
	readonly onUpdateIdentity?: AuthenticationHandler;
	readonly onDeleteIdentity?: AuthenticationHandler;
};

export type AuthenticationHandler = (
	context: IContext,
	request: Request,
	identity: ID,
) => void | Promise<void>;
export type AuthenticationViewPrompParams = {
	request: Request;
	context: IContext;
	step: AuthenticationCeremonyComponent;
	isFirstStep: boolean;
	isLastStep: boolean;
};

export class AuthenticationConfigurationBuilder {
	#enabled = false;
	#securityKeys?: AuthenticationKeys;
	#securitySalt?: string;
	#allowAnonymousIdentity?: boolean;
	#ceremony?: AuthenticationCeremonyComponent;
	#identificators = new Map<string, AuthenticationIdenticator>();
	#challengers = new Map<string, AuthenticationChallenger>();
	#onCreateIdentityHandler?: AuthenticationHandler;
	#onUpdateIdentityHandler?: AuthenticationHandler;
	#onDeleteIdentityHandler?: AuthenticationHandler;
	#highRiskActionTimeWindow?: number;
	#rateLimit?: {
		identificationCount: number;
		identificationInterval: number;
		challengeCount: number;
		challengeInterval: number;
		confirmVerificationCodeCount: number;
		confirmVerificationCodeInterval: number;
	};
	#expirations?: {
		accessToken: number;
		refreshToken: number;
	};

	public setEnabled(enabled: boolean): this {
		this.#enabled = enabled;
		return this;
	}

	/**
	 * Defines the authentication keys and algorith
	 * @param keys The keys
	 * @returns The builder
	 */
	public setSecurityKeys(keys: AuthenticationKeys): this {
		this.#securityKeys = keys;
		return this;
	}

	/**
	 * Defines the salt
	 * @param keys The salt
	 * @returns The builder
	 */
	public setSecuritySalt(salt: string): this {
		this.#securitySalt = salt;
		return this;
	}

	public setRateLimit(limits: {
		identificationCount: number;
		identificationInterval: number;
		challengeCount: number;
		challengeInterval: number;
		confirmVerificationCodeCount: number;
		confirmVerificationCodeInterval: number;
	}): this {
		this.#rateLimit = {
			identificationCount: limits.identificationCount,
			identificationInterval: limits.identificationInterval,
			challengeCount: limits.challengeCount,
			challengeInterval: limits.challengeInterval,
			confirmVerificationCodeCount: limits.confirmVerificationCodeCount,
			confirmVerificationCodeInterval: limits.confirmVerificationCodeInterval,
		};
		return this;
	}

	public setExpirations(expirations: {
		accessToken: number;
		refreshToken: number;
	}): this {
		this.#expirations = {
			accessToken: expirations.accessToken,
			refreshToken: expirations.refreshToken,
		};
		return this;
	}

	public setAllowAnonymousIdentity(allow: boolean): this {
		this.#allowAnonymousIdentity = !!allow;
		return this;
	}

	/**
	 * Defines the authentication methods and their login methods
	 * @param component The allowed authentication methods
	 * @returns The builder
	 */
	public setCeremony(component: AuthenticationCeremonyComponent): this {
		assertAuthenticationCeremonyComponent(component);
		this.#ceremony = component;
		return this;
	}

	/**
	 * Defines an authentication identicator
	 * @param component The authentication identicator
	 * @returns The builder
	 */
	public addIdenticator(
		id: string,
		identicator: AuthenticationIdenticator,
	): this {
		this.#identificators.set(id, identicator);
		return this;
	}

	/**
	 * Defines an authentication challenger
	 * @param component The authentication challenger
	 * @returns The builder
	 */
	public addChallenger(
		id: string,
		challenger: AuthenticationChallenger,
	): this {
		this.#challengers.set(id, challenger);
		return this;
	}

	/**
	 * Defines the high-risk action time window
	 * @param timeWindow The time window in seconds
	 * @returns The builder
	 */
	public setHighRiskActionTimeWindow(timeWindow: number): this {
		this.#highRiskActionTimeWindow = timeWindow;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a new {@see Identity} is created
	 * @param handler The callback
	 * @returns The builder
	 */
	public onCreateIdentity(handler: AuthenticationHandler): this {
		this.#onCreateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is updated
	 * @param handler The callback
	 * @returns The builder
	 */
	public onUpdateIdentity(handler: AuthenticationHandler): this {
		this.#onUpdateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is delete
	 * @param handler The callback
	 * @returns The builder
	 */
	public onDeleteIdentity(handler: AuthenticationHandler): this {
		this.#onDeleteIdentityHandler = handler;
		return this;
	}

	/**
	 * Finalize the {@see AuthConfiguration}
	 * @returns The finalized {@see AuthConfiguration} object
	 */
	public build(): AuthenticationConfiguration {
		if (!this.#securityKeys) {
			throw new Error(`Authentication keys are needed.`);
		}
		if (!this.#ceremony) {
			throw new Error(`Authentication flow is needed.`);
		}
		if (!this.#securitySalt) {
			throw new Error(`Authentication salt is needed.`);
		}
		return {
			enabled: this.#enabled,
			security: {
				keys: this.#securityKeys,
				salt: this.#securitySalt,
				rateLimit: {
					identificationCount: 100,
					identificationInterval: 60,
					challengeCount: 5,
					challengeInterval: 60,
					confirmVerificationCodeCount: 5,
					confirmVerificationCodeInterval: 60,
					...this.#rateLimit,
				},
			},
			expirations: {
				accessToken: this.#expirations?.accessToken ?? 1000 * 60 * 10,
				refreshToken: this.#expirations?.refreshToken ??
					1000 * 60 * 60 * 24 * 7,
			},
			allowAnonymousIdentity: this.#allowAnonymousIdentity ?? false,
			highRiskActionTimeWindow: this.#highRiskActionTimeWindow ?? 60 * 5,
			ceremony: simplify(sequence(this.#ceremony, { kind: "done" as const })),
			identificators: new Map(this.#identificators),
			challengers: new Map(this.#challengers),
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
		};
	}
}
