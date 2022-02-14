export type AuthIdentifier = string;

/**
 * User interface
 */
export class User<Metadata = Record<never, never>> {
	public constructor(
		/**
		 * Unique identifier of the user
		 */
		public id: AuthIdentifier,
		/**
		 * Unique email of the user
		 */
		public email: string | null,
		/**
		 * Has user confirmed his email?
		 */
		public emailConfirmed: boolean,
		/**
		 * Unique token used to invalidate refresh_token
		 */
		public refreshTokenId: string,
		/**
		 * Metadata of the object
		 */
		public metadata: Metadata,
	) {}
}

/**
 * Anonymous user disabled error
 */
export class AnonymousUserError extends Error {
	public name = "AnonymousUserError";
}

/**
 * User not found error
 */
export class UserNotFoundError extends Error {
	public name = "UserNotFoundError";
}

/**
 * Email not found error
 */
export class EmailNotFoundError extends Error {
	public name = "EmailNotFoundError";
}

/**
 * User already exists error
 */
export class UserAlreadyExistsError extends Error {
	public name = "UserAlreadyExistsError";
}

/**
 * User needs an email error
 */
export class UserNeedsAnEmailError extends Error {
	public name = "UserNeedsAnEmailError";
}

/**
 * Email needs confirmation error
 */
export class EmailNeedsConfirmationError extends Error {
	public name = "EmailNeedsConfirmationError";
}

/**
 * Create user password error
 */
export class CreateUserError extends Error {
	public name = "CreateUserError";
}

/**
 * Update user password error
 */
export class UpdateUserError extends Error {
	public name = "UpdateUserError";
}

/**
 * Delete user password error
 */
export class DeleteUserError extends Error {
	public name = "DeleteUserError";
}

/**
 * Add sign in with email password error
 */
export class AddSignInEmailPasswordError extends Error {
	public name = "AddSignInEmailPasswordError";
}

/**
 * Sign in with email password error
 */
export class SignInEmailPasswordError extends Error {
	public name = "SignInEmailPasswordError";
}

/**
 * Set validation code error
 */
export class SetValidationCodeError extends Error {
	public name = "SetValidationCodeError";
}

/**
 * Validation code error
 */
export class ValidationCodeError extends Error {
	public name = "ValidationCodeError";
}

/**
 * Set password reset error
 */
export class SetPasswordResetError extends Error {
	public name = "SetPasswordResetError";
}

/**
 * Password reset error
 */
export class PasswordResetError extends Error {
	public name = "PasswordResetError";
}
