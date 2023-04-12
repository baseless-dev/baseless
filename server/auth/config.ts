import { Context } from "../context.ts";
import { Identity } from "../providers/identity.ts";
import { assertAuthenticationStep, AuthenticationStep, flatten } from "./flow.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";

export interface AuthenticationKeys {
	readonly algo: string;
	readonly privateKey: KeyLike;
	readonly publicKey: KeyLike;
}

export interface AuthenticationConfiguration {
	readonly keys: AuthenticationKeys;
	readonly salt: string;
	readonly flow: AuthenticationStep;
	readonly flattenedFlow: AuthenticationStep;
	readonly onCreateIdentity?: AuthenticationHandler;
	readonly onUpdateIdentity?: AuthenticationHandler;
	readonly onDeleteIdentity?: AuthenticationHandler;
	readonly views?: AuthViews;
	readonly rateLimitIdentificationCount: number;
	readonly rateLimitIdentificationInterval: number;
	readonly rateLimitChallengeCount: number;
	readonly rateLimitChallengeInterval: number;
}

export type AuthenticationHandler = (context: Context, request: Request, identity: Identity) => void | Promise<void>;
export interface AuthenticationViewPrompParams {
	request: Request;
	context: Context;
	step: AuthenticationStep;
	isFirstStep: boolean;
	isLastStep: boolean;
}
export interface AuthViews {
	index(request: Request, context: Context): string;
	rateLimited(request: Request, context: Context): string;
	promptChoice(options: AuthenticationViewPrompParams): string;
	promptEmail(options: AuthenticationViewPrompParams): string;
	promptPassword(options: AuthenticationViewPrompParams): string;
	promptOTP(options: AuthenticationViewPrompParams): string;
}
export class AuthBuilder {
	#authKeys?: AuthenticationKeys;
	#salt?: string;
	#authFlow?: AuthenticationStep;
	#onCreateIdentityHandler?: AuthenticationHandler;
	#onUpdateIdentityHandler?: AuthenticationHandler;
	#onDeleteIdentityHandler?: AuthenticationHandler;
	#viewsHandler?: AuthViews;
	#rateLimitIdentificationCount?: number;
	#rateLimitIdentificationInterval?: number;
	#rateLimitChallengeCount?: number;
	#rateLimitChallengeInterval?: number;

	/**
	 * Defines the authentication keys and algorith
	 * @param keys The keys
	 * @returns The builder
	 */
	public keys(keys: AuthenticationKeys) {
		this.#authKeys = keys;
		return this;
	}

	/**
	 * Defines the salt
	 * @param keys The salt
	 * @returns The builder
	 */
	public setSalt(salt: string) {
		this.#salt = salt;
		return this;
	}

	/**
	 * Defines the authentication methods and their login methods
	 * @param flow The allowed authentication methods
	 * @returns The builder
	 */
	public flow(flow: AuthenticationStep) {
		assertAuthenticationStep(flow);
		this.#authFlow = flow;
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
	public setViews(handler: AuthViews) {
		this.#viewsHandler = handler;
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
		if (!this.#authKeys) {
			throw new Error(`Authentication keys are needed.`);
		}
		if (!this.#authFlow) {
			throw new Error(`Authentication flow is needed.`);
		}
		if (!this.#salt) {
			throw new Error(`Authentication salt is needed.`);
		}
		return {
			keys: this.#authKeys,
			salt: this.#salt,
			flow: this.#authFlow,
			flattenedFlow: flatten(this.#authFlow),
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
			views: this.#viewsHandler,
			rateLimitIdentificationCount: this.#rateLimitIdentificationCount ?? 100,
			rateLimitIdentificationInterval: this.#rateLimitIdentificationInterval ?? 60,
			rateLimitChallengeCount: this.#rateLimitChallengeCount ?? 5,
			rateLimitChallengeInterval: this.#rateLimitChallengeInterval ?? 60,
		};
	}
}
