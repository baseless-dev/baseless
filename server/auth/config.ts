import { AuthenticationChallenger } from "../../common/auth/challenger.ts";
import { AuthenticationIdenticator } from "../../common/auth/identicator.ts";
import {
	assertAuthenticationCeremonyComponent,
	AuthenticationCeremonyComponent,
} from "../../common/auth/ceremony/ceremony.ts";
import { Identity } from "../../common/identity/identity.ts";
import { Context } from "../context.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";

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
	readonly ceremony: AuthenticationCeremonyComponent;
	readonly identificators: Map<string, AuthenticationIdenticator>;
	readonly chalengers: Map<string, AuthenticationChallenger>;
	readonly onCreateIdentity?: AuthenticationHandler;
	readonly onUpdateIdentity?: AuthenticationHandler;
	readonly onDeleteIdentity?: AuthenticationHandler;
};

export type AuthenticationHandler = (
	context: Context,
	request: Request,
	identity: Identity,
) => void | Promise<void>;
export type AuthenticationViewPrompParams = {
	request: Request;
	context: Context;
	step: AuthenticationCeremonyComponent;
	isFirstStep: boolean;
	isLastStep: boolean;
};
export interface AuthenticationRenderer {
	index(request: Request, context: Context): string;
	rateLimited(request: Request, context: Context): string;
	promptChoice(options: AuthenticationViewPrompParams): string;
	promptEmail(options: AuthenticationViewPrompParams): string;
	promptPassword(options: AuthenticationViewPrompParams): string;
	promptOTP(options: AuthenticationViewPrompParams): string;
}
export class AuthenticationConfigurationBuilder {
	#enabled = false;
	#securityKeys?: AuthenticationKeys;
	#securitySalt?: string;
	#ceremony?: AuthenticationCeremonyComponent;
	#identificators = new Map<string, AuthenticationIdenticator>();
	#challengers = new Map<string, AuthenticationChallenger>();
	#onCreateIdentityHandler?: AuthenticationHandler;
	#onUpdateIdentityHandler?: AuthenticationHandler;
	#onDeleteIdentityHandler?: AuthenticationHandler;
	#rateLimit?: {
		identificationCount: number;
		identificationInterval: number;
		challengeCount: number;
		challengeInterval: number;
		confirmVerificationCodeCount: number;
		confirmVerificationCodeInterval: number;
	};

	public setEnabled(enabled: boolean) {
		this.#enabled = enabled;
		return this;
	}

	/**
	 * Defines the authentication keys and algorith
	 * @param keys The keys
	 * @returns The builder
	 */
	public setSecurityKeys(keys: AuthenticationKeys) {
		this.#securityKeys = keys;
		return this;
	}

	/**
	 * Defines the salt
	 * @param keys The salt
	 * @returns The builder
	 */
	public setSecuritySalt(salt: string) {
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
	}) {
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

	/**
	 * Defines the authentication methods and their login methods
	 * @param component The allowed authentication methods
	 * @returns The builder
	 */
	public setCeremony(component: AuthenticationCeremonyComponent) {
		assertAuthenticationCeremonyComponent(component);
		this.#ceremony = component;
		return this;
	}

	/**
	 * Defines a identificator
	 * @param type The identification type
	 * @param identicator The {@link AuthenticationIdenticator}
	 * @returns The builder
	 */
	public addIdentificator(
		type: string,
		identicator: AuthenticationIdenticator,
	) {
		this.#identificators.set(type, identicator);
		return this;
	}

	/**
	 * Defines a challenger
	 * @param type The challenger type
	 * @param challenger The {@link AuthenticationChallenger}
	 * @returns The builder
	 */
	public addChallenger(type: string, challenger: AuthenticationChallenger) {
		this.#challengers.set(type, challenger);
		return this;
	}

	/**
	 * Defines a callback to be triggered when a new {@see Identity} is created
	 * @param handler The callback
	 * @returns The builder
	 */
	public onCreateIdentity(handler: AuthenticationHandler) {
		this.#onCreateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is updated
	 * @param handler The callback
	 * @returns The builder
	 */
	public onUpdateIdentity(handler: AuthenticationHandler) {
		this.#onUpdateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is delete
	 * @param handler The callback
	 * @returns The builder
	 */
	public onDeleteIdentity(handler: AuthenticationHandler) {
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
			ceremony: this.#ceremony,
			identificators: new Map(this.#identificators),
			chalengers: new Map(this.#challengers),
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
		};
	}
}

export class AuthenticationMissingIdentificatorError extends Error { }
export class AuthenticationMissingChallengerError extends Error { }
