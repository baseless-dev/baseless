import { IContext } from "./context.ts";
import { Message } from "./mail.ts";
import { NoopServiceError } from "./mod.ts";

/**
 * Unique identifier for a user
 */
export type AuthIdentifier = string;

/**
 * User
 */
export interface IUser<Metadata> {
	/**
	 * Unique identifier of the user
	 */
	id: AuthIdentifier;

	/**
	 * Unique email of the user
	 */
	email: string | null;

	/**
	 * Has user confirmed his email?
	 */
	emailConfirmed: boolean;

	/**
	 * Unique token used to invalidate refresh_token
	 */
	refreshTokenId: string;

	/**
	 * Metadata of the object
	 */
	metadata: Metadata;
}

export type AuthHandler<Metadata> = (
	ctx: IContext,
	auth: IUser<Metadata>,
) => Promise<void>;

export type MessageTemplate = Omit<Message, "to"> & { link: string };

export type LocalizedMessageTemplate = Map<string, MessageTemplate>;

/**
 * Auth descriptor
 */
export type AuthDescriptor = {
	readonly allowAnonymousUser: boolean;
	readonly allowSignMethodPassword: boolean;
	readonly templates: {
		verification: LocalizedMessageTemplate;
		passwordReset: LocalizedMessageTemplate;
	};
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
	private templates: {
		verification: LocalizedMessageTemplate;
		passwordReset: LocalizedMessageTemplate;
	} = {
		verification: new Map(),
		passwordReset: new Map(),
	};
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
			templates: {
				verification: this.templates.verification,
				passwordReset: this.templates.passwordReset,
			},
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
	 * Set the verification email template
	 */
	public setTemplateVerification(locale: string, message: MessageTemplate) {
		this.templates.verification.set(locale, message);
		return this;
	}

	/**
	 * Set the password reset template
	 */
	public setTemplatePasswordReset(locale: string, message: MessageTemplate) {
		this.templates.passwordReset.set(locale, message);
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

/**
 * User not found error
 */
export class UserNotFoundError extends Error {
	public name = "UserNotFoundError";
	public constructor(userid: string) {
		super(`User '${userid}' not found.`);
	}
}

/**
 * User already exists error
 */
export class UserAlreadyExistsError extends Error {
	public name = "UserAlreadyExistsError";
	public constructor(userid: string) {
		super(`User '${userid}' already exists.`);
	}
}

/**
 * User needs an email error
 */
export class UserNeedsAnEmailError extends Error {
	public name = "UserNeedsAnEmailError";
	public constructor(userid: string) {
		super(`User '${userid}' needs an email.`);
	}
}

/**
 * Validation code error
 */
export class ValidationCodeError extends Error {
	public name = "ValidationCodeError";
}

/**
 * Password reset error
 */
export class PasswordResetError extends Error {
	public name = "PasswordResetError";
}

/**
 * Password reset code error
 */
export class PasswordResetCodeError extends Error {
	public name = "PasswordResetCodeError";
}

/**
 * Auth Provider
 */
export interface IAuthProvider {
	/**
	 * Get the User of the auth identifier
	 */
	getUser<Metadata>(userid: AuthIdentifier): Promise<IUser<Metadata>>;

	/**
	 * Get the User by email
	 */
	getUserByEmail<Metadata>(email: string): Promise<IUser<Metadata>>;

	/**
	 * Create user with metadata
	 */
	createUser<Metadata>(
		email: string | null,
		metadata: Metadata,
	): Promise<IUser<Metadata>>;

	/**
	 * Update an User
	 */
	updateUser<Metadata>(
		userid: AuthIdentifier,
		metadata: Partial<Metadata>,
		email?: string,
		emailConfirmed?: boolean,
		refreshTokenId?: string,
	): Promise<void>;

	/**
	 * Delete an User
	 */
	deleteUser(userid: AuthIdentifier): Promise<void>;

	/**
	 * Retrieve user sign-in methods
	 */
	getSignInMethods(userid: string): Promise<string[]>;

	/**
	 * Add sign-in method email-password to userid
	 */
	addSignInMethodPassword(
		userid: string,
		email: string,
		passwordHash: string,
	): Promise<void>;

	/**
	 * Sign-in with email and passwordHash
	 */
	signInWithEmailPassword<Metadata>(
		email: string,
		passwordHash: string,
	): Promise<IUser<Metadata>>;

	/**
	 * Set email validation code
	 */
	setEmailValidationCode(email: string, code: string): Promise<void>;

	/**
	 * Validate email with code
	 */
	validateEmailWithCode(email: string, code: string): Promise<void>;

	/**
	 * Set password reset code
	 */
	setPasswordResetCode(email: string, code: string): Promise<void>;

	/**
	 * Reset password with email and code
	 */
	resetPasswordWithCode(
		email: string,
		code: string,
		passwordHash: string,
	): Promise<void>;
}

/**
 * Auth service
 */
export interface IAuthService {
	/**
	 * Get the User of the auth identifier
	 */
	getUser<Metadata>(userid: AuthIdentifier): Promise<IUser<Metadata>>;

	/**
	 * Get the User by email
	 */
	getUserByEmail<Metadata>(email: string): Promise<IUser<Metadata>>;

	/**
	 * Create user with metadata
	 */
	createUser<Metadata>(
		email: string | null,
		metadata: Metadata,
	): Promise<IUser<Metadata>>;

	/**
	 * Update an User
	 */
	updateUser<Metadata>(
		userid: AuthIdentifier,
		metadata: Partial<Metadata>,
		email?: string,
		emailConfirmed?: boolean,
		refreshTokenId?: string,
	): Promise<void>;

	/**
	 * Delete an User
	 */
	deleteUser(userid: AuthIdentifier): Promise<void>;

	/**
	 * Retrieve user sign-in methods
	 */
	getSignInMethods(userid: string): Promise<string[]>;

	/**
	 * Add sign-in method email-password to userid
	 */
	addSignInMethodPassword(
		userid: string,
		email: string,
		passwordHash: string,
	): Promise<void>;

	/**
	 * Sign-in with email and passwordHash
	 */
	signInWithEmailPassword<Metadata>(
		email: string,
		passwordHash: string,
	): Promise<IUser<Metadata>>;

	/**
	 * Set email validation code
	 */
	setEmailValidationCode(email: string, code: string): Promise<void>;

	/**
	 * Validate email with code
	 */
	validateEmailWithCode(email: string, code: string): Promise<void>;

	/**
	 * Set password reset code
	 */
	setPasswordResetCode(email: string, code: string): Promise<void>;

	/**
	 * Reset password with email and code
	 */
	resetPasswordWithCode(
		email: string,
		code: string,
		passwordHash: string,
	): Promise<void>;
}

/**
 * Auth service backed by an IKVProvider
 */
export class AuthService implements IAuthService {
	/**
	 * Construct an new AuthService backed by an IAuthProvider
	 */
	constructor(protected backend: IAuthProvider) {}

	/**
	 * Get the IUser of the auth identifier
	 */
	getUser<Metadata>(userid: AuthIdentifier): Promise<IUser<Metadata>> {
		return this.backend.getUser<Metadata>(userid);
	}

	/**
	 * Get the IUser by email
	 */
	getUserByEmail<Metadata>(email: string): Promise<IUser<Metadata>> {
		return this.backend.getUserByEmail<Metadata>(email);
	}

	/**
	 * Create user with metadata
	 */
	createUser<Metadata>(
		email: string | null,
		metadata: Metadata,
	): Promise<IUser<Metadata>> {
		return this.backend.createUser<Metadata>(email, metadata);
	}

	/**
	 * Update a IUser
	 */
	updateUser<Metadata>(userid: string, metadata: Metadata): Promise<void> {
		return this.backend.updateUser<Metadata>(userid, metadata);
	}

	/**
	 * Delete a IUser
	 */
	deleteUser(userid: AuthIdentifier): Promise<void> {
		return this.backend.deleteUser(userid);
	}

	/**
	 * Retrieve user sign-in methods
	 */
	getSignInMethods(userid: string): Promise<string[]> {
		return this.backend.getSignInMethods(userid);
	}

	/**
	 * Add sign-in method email-password to userid
	 */
	addSignInMethodPassword(
		userid: string,
		email: string,
		passwordHash: string,
	): Promise<void> {
		return this.backend.addSignInMethodPassword(userid, email, passwordHash);
	}

	/**
	 * Sign-in with email and passwordHash
	 */
	signInWithEmailPassword<Metadata>(
		email: string,
		passwordHash: string,
	): Promise<IUser<Metadata>> {
		return this.backend.signInWithEmailPassword<Metadata>(email, passwordHash);
	}

	/**
	 * Set email validation code
	 */
	setEmailValidationCode(email: string, code: string): Promise<void> {
		return this.backend.setEmailValidationCode(email, code);
	}

	/**
	 * Validate email with code
	 */
	validateEmailWithCode(email: string, code: string): Promise<void> {
		return this.backend.validateEmailWithCode(email, code);
	}

	/**
	 * Set password reset code
	 */
	setPasswordResetCode(email: string, code: string): Promise<void> {
		return this.backend.setPasswordResetCode(email, code);
	}

	/**
	 * Reset password with email and code
	 */
	resetPasswordWithCode(
		email: string,
		code: string,
		passwordHash: string,
	): Promise<void> {
		return this.backend.resetPasswordWithCode(email, code, passwordHash);
	}
}

/**
 * Noop Auth service
 */
export class NoopAuthService implements IAuthService {
	/**
	 * Get the IUser of the auth identifier
	 */
	getUser<Metadata>(): Promise<IUser<Metadata>> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Get the IUser by email
	 */
	getUserByEmail<Metadata>(): Promise<IUser<Metadata>> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Create user with metadata
	 */
	createUser<Metadata>(): Promise<IUser<Metadata>> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Update a IUser
	 */
	updateUser(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Delete a IUser
	 */
	deleteUser(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Retrieve user sign-in methods
	 */
	getSignInMethods(): Promise<string[]> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Add sign-in method email-password to userid
	 */
	addSignInMethodPassword(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Sign-in with email and passwordHash
	 */
	signInWithEmailPassword<Metadata>(): Promise<IUser<Metadata>> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Set email validation code
	 */
	setEmailValidationCode(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Validate email with code
	 */
	validateEmailWithCode(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Set password reset code
	 */
	setPasswordResetCode(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}

	/**
	 * Reset password with email and code
	 */
	resetPasswordWithCode(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}
}
