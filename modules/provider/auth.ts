import type { AuthIdentifier } from "https://baseless.dev/x/shared/auth.ts";
import { User } from "https://baseless.dev/x/shared/auth.ts";
import { NoopError } from "./mod.ts";

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
		metadata?: Metadata,
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
		passwordHash: string,
	): Promise<void>;

	/**
	 * Update password of user
	 */
	updatePassword(
		userid: string,
		newPasswordHash: string,
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
 *
 * @internal
 */
export class NoopAuthProvider implements IAuthProvider {
	getUser() {
		return Promise.reject(new NoopError());
	}

	getUserByEmail() {
		return Promise.reject(new NoopError());
	}

	createUser() {
		return Promise.reject(new NoopError());
	}

	updateUser() {
		return Promise.reject(new NoopError());
	}

	deleteUser() {
		return Promise.reject(new NoopError());
	}

	getSignInMethods() {
		return Promise.reject(new NoopError());
	}

	addSignInMethodPassword() {
		return Promise.reject(new NoopError());
	}

	updatePassword() {
		return Promise.reject(new NoopError());
	}

	signInWithEmailPassword() {
		return Promise.reject(new NoopError());
	}

	setEmailValidationCode() {
		return Promise.reject(new NoopError());
	}

	validateEmailWithCode() {
		return Promise.reject(new NoopError());
	}

	setPasswordResetCode() {
		return Promise.reject(new NoopError());
	}

	resetPasswordWithCode() {
		return Promise.reject(new NoopError());
	}
}
