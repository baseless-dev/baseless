import { Context } from "https://baseless.dev/x/provider/context.ts";
import { User } from "https://baseless.dev/x/shared/auth.ts";

export type AuthHandler<Metadata> = (
	ctx: Context,
	auth: User<Metadata>,
) => Promise<void>;

/**
 * Auth descriptor
 */
export type AuthDescriptor = {
	readonly allowAnonymousUser: boolean;
	readonly allowSignMethodPassword: boolean;
	readonly onCreateUser?: AuthHandler<unknown>;
	readonly onUpdateUser?: AuthHandler<unknown>;
	readonly onDeleteUser?: AuthHandler<unknown>;
};

/**
 * Auth builder
 */
export class AuthBuilder {
	private allowAnonymousUserValue?: boolean;
	private allowSignMethodPasswordValue?: boolean;
	private onCreateUserHandler?: AuthHandler<unknown>;
	private onUpdateUserHandler?: AuthHandler<unknown>;
	private onDeleteUserHandler?: AuthHandler<unknown>;

	/**
	 * Build the auth descriptor
	 */
	public build(): AuthDescriptor {
		return {
			allowAnonymousUser: this.allowAnonymousUserValue ?? false,
			allowSignMethodPassword: this.allowSignMethodPasswordValue ?? false,
			onCreateUser: this.onCreateUserHandler,
			onUpdateUser: this.onUpdateUserHandler,
			onDeleteUser: this.onDeleteUserHandler,
		};
	}

	/**
	 * Allow anonymous user
	 */
	public allowAnonymousUser(value: boolean) {
		this.allowAnonymousUserValue = value;
		return this;
	}

	/**
	 * Allow sign method password
	 */
	public allowSignMethodPassword(value: boolean) {
		this.allowSignMethodPasswordValue = value;
		return this;
	}

	/**
	 * Set the create handler
	 */
	public onCreateUser(handler: AuthHandler<unknown>) {
		this.onCreateUserHandler = handler;
		return this;
	}

	/**
	 * Set the update handler
	 */
	public onUpdateUser(handler: AuthHandler<unknown>) {
		this.onUpdateUserHandler = handler;
		return this;
	}

	/**
	 * Set the delete handler
	 */
	public onDeleteUser(handler: AuthHandler<unknown>) {
		this.onDeleteUserHandler = handler;
		return this;
	}
}

export const auth = new AuthBuilder();
