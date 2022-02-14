import { AuthIdentifier, User } from "https://baseless.dev/x/shared/auth.ts";
import { NoopProviderError } from "./mod.ts";

/**
 * Auth Provider
 */
export interface IAuthProvider {
	/**
	 * Get the User of the auth identifier
	 */
	getUser<Metadata>(userid: AuthIdentifier): Promise<User<Metadata>>;

	/**
	 * Get the User by email
	 */
	getUserByEmail<Metadata>(email: string): Promise<User<Metadata>>;

	/**
	 * Create user with metadata
	 */
	createUser<Metadata>(
		email: string | null,
		metadata: Metadata,
	): Promise<User<Metadata>>;

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
	): Promise<User<Metadata>>;

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
 * Noop Auth Provider
 */
export class NoopAuthProvider implements IAuthProvider {
	/**
	 * Get the IUser of the auth identifier
	 */
	getUser<Metadata>(): Promise<User<Metadata>> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Get the IUser by email
	 */
	getUserByEmail<Metadata>(): Promise<User<Metadata>> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Create user with metadata
	 */
	createUser<Metadata>(): Promise<User<Metadata>> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Update a IUser
	 */
	updateUser(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Delete a IUser
	 */
	deleteUser(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Retrieve user sign-in methods
	 */
	getSignInMethods(): Promise<string[]> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Add sign-in method email-password to userid
	 */
	addSignInMethodPassword(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Sign-in with email and passwordHash
	 */
	signInWithEmailPassword<Metadata>(): Promise<User<Metadata>> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Set email validation code
	 */
	setEmailValidationCode(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Validate email with code
	 */
	validateEmailWithCode(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Set password reset code
	 */
	setPasswordResetCode(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}

	/**
	 * Reset password with email and code
	 */
	resetPasswordWithCode(): Promise<void> {
		return Promise.reject(new NoopProviderError());
	}
}
