import { Context } from "../context.ts";
import { Identity } from "./identity.ts";
import { AuthStepDefinition, chain, email, password, assertAuthStepDefinition } from "./flow.ts";

export interface AuthConfiguration {
	readonly authFlow: AuthStepDefinition;
	readonly onCreateIdentity?: AuthHandler;
	readonly onUpdateIdentity?: AuthHandler;
	readonly onDeleteIdentity?: AuthHandler;
	readonly views?: AuthViews;
}

export type AuthHandler = (context: Context, request: Request, identity: Identity) => void | Promise<void>;
export interface AuthViews {
	login(request: Request, configuration: AuthConfiguration): Response;
}
export class AuthBuilder {
	#authFlow: AuthStepDefinition = chain(email(), password());
	#onCreateIdentityHandler?: AuthHandler;
	#onUpdateIdentityHandler?: AuthHandler;
	#onDeleteIdentityHandler?: AuthHandler;
	#viewsHandler?: AuthViews;

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
		return {
			authFlow: this.#authFlow,
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
			views: this.#viewsHandler,
		};
	}
}
