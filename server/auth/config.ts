import { Context } from "../context.ts";
import { Identity } from "../providers/identity.ts";
import { assertAuthenticationStep, AuthenticationStep, NextAuthenticationStepResult, flatten } from "./flow.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";

export interface AuthenticationKeys {
	readonly algo: string;
	readonly privateKey: KeyLike;
	readonly publicKey: KeyLike;
}

export interface AuthenticationConfiguration {
	readonly keys: AuthenticationKeys;
	readonly flow: AuthenticationStep;
	readonly flattenedFlow: AuthenticationStep;
	readonly onCreateIdentity?: AuthenticationHandler;
	readonly onUpdateIdentity?: AuthenticationHandler;
	readonly onDeleteIdentity?: AuthenticationHandler;
	readonly views?: AuthViews;
}

export type AuthenticationHandler = (context: Context, request: Request, identity: Identity) => void | Promise<void>;
export interface AuthenticationViewLoggedParams {
	request: Request;
	context: Context;
}
export interface AuthenticationViewLoginParams {
	request: Request;
	context: Context;
	step: AuthenticationStep;
	isFirstStep: boolean;
	isLastStep: boolean;
}
export interface AuthViews {
	index(options: AuthenticationViewLoggedParams): string;
	promptChoice(options: AuthenticationViewLoginParams): string;
	promptEmail(options: AuthenticationViewLoginParams): string;
	promptPassword(options: AuthenticationViewLoginParams): string;
	promptOTP(options: AuthenticationViewLoginParams): string;
}
export class AuthBuilder {
	#authKeys?: AuthenticationKeys;
	#authFlow?: AuthenticationStep;
	#onCreateIdentityHandler?: AuthenticationHandler;
	#onUpdateIdentityHandler?: AuthenticationHandler;
	#onDeleteIdentityHandler?: AuthenticationHandler;
	#viewsHandler?: AuthViews;

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
		return {
			keys: this.#authKeys,
			flow: this.#authFlow,
			flattenedFlow: flatten(this.#authFlow),
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
			views: this.#viewsHandler,
		};
	}
}
