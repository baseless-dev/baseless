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
