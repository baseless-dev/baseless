import { Context } from "../context.ts";
import { Identity } from "./identity.ts";
import { AuthenticationMethod, email, password } from "./signInMethod.ts";

export interface AuthConfiguration {
	readonly signInFlow: ReadonlyArray<AuthenticationMethod>;
	readonly onCreateIdentity?: AuthHandler;
	readonly onUpdateIdentity?: AuthHandler;
	readonly onDeleteIdentity?: AuthHandler;
	readonly render?: AuthRenderer;
}

export type AuthHandler = (context: Context, request: Request, identity: Identity) => void | Promise<void>;
export type AuthRenderer = (context: Context, request: Request) => Response | undefined | Promise<Response | undefined>;
export class AuthBuilder {
	#signInFlow: AuthenticationMethod[] = [email(password())];
	#onCreateIdentityHandler?: AuthHandler;
	#onUpdateIdentityHandler?: AuthHandler;
	#onDeleteIdentityHandler?: AuthHandler;
	#rendererHandler?: AuthRenderer;

	/**
	 * Defines the authentication methods and their login methods
	 * @param flow The allowed authentication methods
	 * @returns The builder
	 */
	public flow(...flow: AuthenticationMethod[]) {
		this.#signInFlow = flow;
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
	public setRenderer(handler: AuthRenderer) {
		this.#rendererHandler = handler;
		return this;
	}

	/**
	 * Finalize the {@see AuthConfiguration}
	 * @returns The finalized {@see AuthConfiguration} object
	 */
	public build(): AuthConfiguration {
		return {
			signInFlow: this.#signInFlow,
			onCreateIdentity: this.#onCreateIdentityHandler,
			onUpdateIdentity: this.#onUpdateIdentityHandler,
			onDeleteIdentity: this.#onDeleteIdentityHandler,
			render: this.#rendererHandler,
		};
	}
}
