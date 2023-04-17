import { Context } from "../context.ts";
import { Identity } from "../providers/identity.ts";
import {
	assertAuthenticationStep,
	AuthenticationChallenger,
	AuthenticationIdenticator,
	AuthenticationStep,
} from "./flow.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";

export type AuthenticationKeys = {
	readonly algo: string;
	readonly privateKey: KeyLike;
	readonly publicKey: KeyLike;
};

export type AuthenticationConfiguration = {
	readonly security: {
		readonly keys: AuthenticationKeys;
		readonly salt: string;
	};
	readonly flow: {
		readonly step: AuthenticationStep;
		readonly identificators: Map<string, AuthenticationIdenticator>;
		readonly chalengers: Map<string, AuthenticationChallenger>;
	};
	readonly onCreateIdentity?: AuthenticationHandler;
	readonly onUpdateIdentity?: AuthenticationHandler;
	readonly onDeleteIdentity?: AuthenticationHandler;
	readonly renderer?: AuthenticationRenderer;
	readonly rateLimit: {
		readonly identificationCount: number;
		readonly identificationInterval: number;
		readonly challengeCount: number;
		readonly challengeInterval: number;
	};
};

export type AuthenticationHandler = (
	context: Context,
	request: Request,
	identity: Identity,
) => void | Promise<void>;
export type AuthenticationViewPrompParams = {
	request: Request;
	context: Context;
	step: AuthenticationStep;
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
	#securityKeys?: AuthenticationKeys;
	#securitySalt?: string;
	#flowStep?: AuthenticationStep;
	#flowIdentificators = new Map<string, AuthenticationIdenticator>();
	#flowChalengers = new Map<string, AuthenticationChallenger>();
	#onCreateIdentityHandler?: AuthenticationHandler;
	#onUpdateIdentityHandler?: AuthenticationHandler;
	#onDeleteIdentityHandler?: AuthenticationHandler;
	#renderer?: AuthenticationRenderer;
	#rateLimitIdentificationCount?: number;
	#rateLimitIdentificationInterval?: number;
	#rateLimitChallengeCount?: number;
	#rateLimitChallengeInterval?: number;

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

	/**
	 * Defines the authentication methods and their login methods
	 * @param step The allowed authentication methods
	 * @returns The builder
	 */
	public setFlowStep(step: AuthenticationStep) {
		assertAuthenticationStep(step);
		this.#flowStep = step;
		return this;
	}

	/**
	 * Defines a flow identificator
	 * @param type The identification type
	 * @param identicator The {@link AuthenticationIdenticator}
	 * @returns The builder
	 */
	public addFlowIdentificator(
		type: string,
		identicator: AuthenticationIdenticator,
	) {
		this.#flowIdentificators.set(type, identicator);
		return this;
	}

	/**
	 * Defines a flow challenger
	 * @param type The challenger type
	 * @param challenger The {@link AuthenticationChallenger}
	 * @returns The builder
	 */
	public addFlowChallenger(type: string, challenger: AuthenticationChallenger) {
		this.#flowChalengers.set(type, challenger);
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
	 * Defines the renderer function that's responsible to build the HTML response the auth endpoint
	 * @param handler The callback
	 * @returns The builder
	 */
	public setRenderer(handler: AuthenticationRenderer) {
		this.#renderer = handler;
		return this;
	}

	public setRateLimitIdentification(count: number, interval: number) {
		this.#rateLimitIdentificationCount = count;
		this.#rateLimitIdentificationInterval = interval;
		return this;
	}

	public setRateLimitChallenge(count: number, interval: number) {
		this.#rateLimitChallengeCount = count;
		this.#rateLimitChallengeInterval = interval;
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
		if (!this.#flowStep) {
			throw new Error(`Authentication flow is needed.`);
		}
		if (!this.#securitySalt) {
			throw new Error(`Authentication salt is needed.`);
		}
		return {
			security: {
				keys: this.#securityKeys,
				salt: this.#securitySalt,
			},
			flow: {
				step: this.#flowStep,
				identificators: new Map(this.#flowIdentificators),
				chalengers: new Map(this.#flowChalengers),
			},
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
			renderer: this.#renderer,
			rateLimit: {
				identificationCount: this.#rateLimitIdentificationCount ?? 100,
				identificationInterval: this.#rateLimitIdentificationInterval ?? 60,
				challengeCount: this.#rateLimitChallengeCount ?? 5,
				challengeInterval: this.#rateLimitChallengeInterval ?? 60,
			},
		};
	}
}
