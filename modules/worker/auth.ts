import { Context } from "https://baseless.dev/x/provider/context.ts";
import { User } from "https://baseless.dev/x/shared/auth.ts";

export type AuthHandler<Metadata> = (
	context: Context,
	user: User<Metadata>,
) => Promise<void>;

/**
 * Auth descriptor
 */
export class AuthDescriptor {
	public constructor(
		public readonly allowAnonymousUser: boolean,
		public readonly allowSignMethodPassword: boolean,
		private readonly onCreateUserHandler?: AuthHandler<unknown>,
		private readonly onUpdateUserHandler?: AuthHandler<unknown>,
		private readonly onDeleteUserHandler?: AuthHandler<unknown>,
	) {}

	public onCreateUser<Metadata>(context: Context, user: User<Metadata>): Promise<void> {
		return this.onCreateUserHandler?.(context, user) ?? Promise.resolve();
	}

	public onUpdateUser<Metadata>(context: Context, user: User<Metadata>): Promise<void> {
		return this.onUpdateUserHandler?.(context, user) ?? Promise.resolve();
	}

	public onDeleteUser<Metadata>(context: Context, user: User<Metadata>): Promise<void> {
		return this.onDeleteUserHandler?.(context, user) ?? Promise.resolve();
	}
}

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
		return new AuthDescriptor(
			this.allowAnonymousUserValue ?? false,
			this.allowSignMethodPasswordValue ?? false,
			this.onCreateUserHandler,
			this.onUpdateUserHandler,
			this.onDeleteUserHandler,
		);
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
