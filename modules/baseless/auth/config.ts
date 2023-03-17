import { Context } from "../context.ts";
import { Identity } from "./identity.ts";
import { assertAuthStepDefinition, AuthStepDecomposedDefinition, AuthStepDefinition, AuthStepNextAtPath, chain, decomposeAuthStep, email, password } from "./flow.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";

export interface AuthKeys {
	readonly algo: string;
	readonly privateKey: KeyLike;
	readonly publicKey: KeyLike;
}

export interface AuthConfiguration {
	readonly authKeys: AuthKeys;
	readonly authFlow: AuthStepDefinition;
	readonly authFlowDecomposed: AuthStepDecomposedDefinition;
	readonly onCreateIdentity?: AuthHandler;
	readonly onUpdateIdentity?: AuthHandler;
	readonly onDeleteIdentity?: AuthHandler;
	readonly views?: AuthViews;
}

export type AuthHandler = (context: Context, request: Request, identity: Identity) => void | Promise<void>;
export interface AuthViewLoginParams {
	request: Request;
	context: Context;
	nextStep: AuthStepNextAtPath;
}
export interface AuthViews {
	login(options: AuthViewLoginParams): string;
}
export class AuthBuilder {
	#authKeys?: AuthKeys;
	#authFlow: AuthStepDefinition = chain(email(), password());
	#onCreateIdentityHandler?: AuthHandler;
	#onUpdateIdentityHandler?: AuthHandler;
	#onDeleteIdentityHandler?: AuthHandler;
	#viewsHandler?: AuthViews;

	/**
	 * Defines the authentication keys and algorith
	 * @param keys The keys
	 * @returns The builder
	 */
	public keys(keys: AuthKeys) {
		this.#authKeys = keys;
		return this;
	}

	/**
	 * Defines the authentication methods and their login methods
	 * @param flow The allowed authentication methods
	 * @returns The builder
	 */
	public flow(flow: AuthStepDefinition) {
		assertAuthStepDefinition(flow);
		this.#authFlow = flow;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a new {@see Identity} is created
	 * @param handler The callback
	 * @returns The builder
	 */
	public onCreateIdentity(handler: AuthHandler) {
		this.#onCreateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is updated
	 * @param handler The callback
	 * @returns The builder
	 */
	public onUpdateIdentity(handler: AuthHandler) {
		this.#onUpdateIdentityHandler = handler;
		return this;
	}

	/**
	 * Defines a callback to be triggered when a {@see Identity} is delete
	 * @param handler The callback
	 * @returns The builder
	 */
	public onDeleteIdentity(handler: AuthHandler) {
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
	public build(): AuthConfiguration {
		if (!this.#authKeys) {
			throw new Error(`Authentication keys are needed.`);
		}
		return {
			authKeys: this.#authKeys,
			authFlow: this.#authFlow,
			authFlowDecomposed: decomposeAuthStep(this.#authFlow),
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
			views: this.#viewsHandler,
		};
	}
}
