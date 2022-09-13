import { Context } from "../context.ts";
import { Identity } from "./identity.ts";
import { createAuthRenderer } from "./renderer.ts";
import { AuthenticationMethod, email, password } from "./signInMethod.ts";

export interface AuthConfiguration {
	readonly signInFlow: ReadonlyArray<AuthenticationMethod>;
	readonly onCreateIdentity?: AuthHandler;
	readonly onUpdateIdentity?: AuthHandler;
	readonly onDeleteIdentity?: AuthHandler;
	readonly render: AuthRenderer;
}

export type AuthHandler = (context: Context, identity: Identity) => void | Promise<void>;

export interface AuthRenderer {
	login(context: Context, request: Request): Response | Promise<Response>;
	password(context: Context, request: Request): Response | Promise<Response>;
	passwordReset(context: Context, request: Request): Response | Promise<Response>;
	forgotPassword(context: Context, request: Request): Response | Promise<Response>;
	otp(context: Context, request: Request): Response | Promise<Response>;
	hotp(context: Context, request: Request): Response | Promise<Response>;
	totp(context: Context, request: Request): Response | Promise<Response>;
	logout(context: Context, request: Request): Response | Promise<Response>;
}

export class AuthBuilder {
	#signInFlow: AuthenticationMethod[] = [email(password())];
	#onCreateIdentityHandler?: AuthHandler;
	#onUpdateIdentityHandler?: AuthHandler;
	#onDeleteIdentityHandler?: AuthHandler;
	#rendererHandler: AuthRenderer = createAuthRenderer();

	/**
	 * Defines the authentication methods and their login methods
	 * @param flow The allowed authentication methods
	 * @returns The builder
	 */
	public flow(...flow: AuthenticationMethod[]) {
		if (!flow.every(m => m instanceof AuthenticationMethod)) {
			throw new TypeError(`Wrong type for authentication method.`);
		}
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
			render: this.#rendererHandler
		};
	}
}