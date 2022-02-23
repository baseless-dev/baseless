import { AuthIdentifier, UpdatePasswordError } from "https://baseless.dev/x/shared/auth.ts";
import {
	PasswordResetError,
	SetPasswordResetError,
	User,
	UserAlreadyExistsError,
	UserNotFoundError,
	ValidationCodeError,
} from "https://baseless.dev/x/shared/auth.ts";
import type { IAuthProvider } from "https://baseless.dev/x/provider/auth.ts";
import { KeyNotFoundError } from "https://baseless.dev/x/shared/kv.ts";
import type { IKVProvider } from "https://baseless.dev/x/provider/kv.ts";
import { autoid } from "https://baseless.dev/x/shared/autoid.ts";
import { logger } from "https://baseless.dev/x/logger/mod.ts";

/**
 * Convert authid to key
 */
function useridToKey(userid: AuthIdentifier) {
	return `user::${userid}`;
}

/**
 * Auth provider backed by an IKVProvider
 */
export class AuthOnKvProvider implements IAuthProvider {
	protected logger = logger("provider-auth-on-kv");

	/**
	 * Construct an new AuthOnKvProvider backed by an IKVProvider
	 */
	constructor(protected backend: IKVProvider) {}

	/**
	 * Get the user of the auth identifier
	 */
	async getUser<Metadata>(userid: AuthIdentifier): Promise<User<Metadata>> {
		const key = useridToKey(userid);
		const value = await this.backend.get<
			{
				email: string;
				emailConfirmed: boolean;
				refreshTokenId: string;
				metadata: Metadata;
			}
		>(key);
		const { email, emailConfirmed, refreshTokenId, metadata } = value.metadata;
		return new User(
			userid,
			email,
			emailConfirmed,
			refreshTokenId,
			metadata,
		);
	}

	/**
	 * Get the IUser by email
	 */
	async getUserByEmail<Metadata>(email: string): Promise<User<Metadata>> {
		try {
			const { metadata: { userid } } = await this.backend.get(
				`email::${email}`,
			);
			const user = await this.getUser<Metadata>(userid);
			return user;
		} catch (err) {
			if (err instanceof KeyNotFoundError) {
				throw new UserNotFoundError(email);
			}
			throw err;
		}
	}

	/**
	 * Update an IAuth
	 */
	async createUser<Metadata>(
		email: string | null,
		metadata: Metadata,
	): Promise<User<Metadata>> {
		const userid = autoid();
		const existingUser = await this.getUser(userid).catch((_) => null);
		if (existingUser) {
			throw new UserAlreadyExistsError(userid);
		}

		if (email) {
			const existingUser = await this.getUserByEmail(email).catch((_) => null);
			if (existingUser) {
				throw new UserAlreadyExistsError(userid);
			}
		}

		const emailConfirmed = false;
		const refreshTokenId = autoid();
		await Promise.all([
			email ? this.backend.set(`email::${email}`, { userid }) : undefined,
			this.backend.set(useridToKey(userid), {
				email,
				emailConfirmed,
				refreshTokenId,
				metadata,
			}),
		]);
		return new User(userid, email, emailConfirmed, refreshTokenId, metadata);
	}

	/**
	 * Update an IAuth
	 */
	async updateUser<Metadata>(
		userid: string,
		metadata?: Metadata,
		email?: string,
		emailConfirmed?: boolean,
		refreshTokenId?: string,
	): Promise<void> {
		const key = useridToKey(userid);
		const user = await this.getUser<Metadata>(userid);
		await this.backend.set(key, {
			email: email ?? user.email,
			emailConfirmed: email ? false : emailConfirmed ?? user.emailConfirmed,
			refreshTokenId: refreshTokenId ?? user.refreshTokenId,
			metadata: metadata ?? user.metadata,
		});
		if (email) {
			const hadSignInPassword = await this.backend.get(`signin::password::${user.email}`).catch((_) => null);
			await Promise.all([
				email ? this.backend.set(`email::${email}`, { userid }) : undefined,
				email ? this.backend.delete(`signin::password::${user.email}`) : undefined,
				email ? this.backend.delete(`validationcode::${user.email}`) : undefined,
				email ? this.backend.delete(`passwordresetcode::${user.email}`) : undefined,
				hadSignInPassword ? this.backend.set(`signin::password::${email}`, hadSignInPassword.metadata) : undefined,
			]);
		}
	}

	/**
	 * Delete an IAuth
	 */
	async deleteUser(userid: AuthIdentifier): Promise<void> {
		const user = await this.getUser(userid);
		const key = useridToKey(userid);
		await Promise.all([
			user.email ? this.backend.delete(`email::${user.email}`) : undefined,
			user.email ? this.backend.delete(`signin::password::${user.email}`) : undefined,
			this.backend.delete(`validationcode::${user.email}`),
			this.backend.delete(`passwordresetcode::${user.email}`),
			this.backend.delete(`usermethod::${userid}::password`),
			this.backend.delete(key),
		]);
	}

	/**
	 * Retrieve user sign-in methods
	 */
	async getSignInMethods(userid: string): Promise<string[]> {
		const prefix = `usermethod::${userid}::`;
		const values = await this.backend.list(prefix);
		return values.map((value) => value.key.substr(prefix.length));
	}

	/**
	 * Add sign-in method email-password to userid
	 */
	async addSignInMethodPassword(
		userid: string,
		passwordHash: string,
	): Promise<void> {
		const user = await this.getUser(userid);
		await Promise.all([
			this.backend.set(`usermethod::${userid}::password`, {}),
			this.backend.set(`signin::password::${user.email}`, {
				passwordHash,
				userid: userid,
			}),
		]);
	}

	/**
	 * Update password of user
	 */
	async updatePassword(
		userid: string,
		newPasswordHash: string,
	): Promise<void> {
		try {
			const user = await this.getUser(userid);
			await this.backend.get(`usermethod::${userid}::password`);
			await this.backend.set(`signin::password::${user.email}`, {
				passwordHash: newPasswordHash,
				userid: userid,
			});
		} catch (_err) {
			throw new UpdatePasswordError();
		}
	}

	/**
	 * Sign-in with email and passwordHash
	 */
	async signInWithEmailPassword<Metadata>(
		email: string,
		passwordHash: string,
	): Promise<User<Metadata>> {
		try {
			// Retrieve password hash for email-password of the email
			const {
				metadata: { passwordHash: hash, userid },
			} = await this.backend.get<{ passwordHash: string; userid: string }>(
				`signin::password::${email}`,
			);
			// Check if hash equals provided hash
			if (hash !== passwordHash) {
				throw new UserNotFoundError(email);
			}
			return await this.getUser(userid);
		} catch (_err) {
			throw new UserNotFoundError(email);
		}
	}

	/**
	 * Set email validation code
	 */
	async setEmailValidationCode(email: string, code: string): Promise<void> {
		const user = await this.getUserByEmail(email);
		await this.backend.set(
			`validationcode::${email}`,
			{ code, userid: user.id },
			undefined,
			{ expireIn: 60 * 5 },
		);
	}

	/**
	 * Validate email with code
	 */
	async validateEmailWithCode(email: string, code: string): Promise<void> {
		try {
			// Retrieve the validation code temporary key
			const value = await this.backend.get<{ code: string; userid: string }>(
				`validationcode::${email}`,
			);
			if (value.metadata.code !== code) {
				throw new ValidationCodeError();
			}
			// Update the user and delete the temporary key
			await Promise.all([
				this.updateUser(value.metadata.userid, {}, undefined, true),
				this.backend.delete(`validationcode::${email}`),
			]);
		} catch (_err) {
			throw new ValidationCodeError();
		}
	}

	/**
	 * Set password reset code
	 */
	async setPasswordResetCode(email: string, code: string): Promise<void> {
		const user = await this.getUserByEmail(email);
		try {
			// Try to get the signin method password
			await this.backend.get(`usermethod::${user.id}::password`);
			// Set the password reset code
			await this.backend.set(
				`passwordresetcode::${email}`,
				{ code, userid: user.id },
				undefined,
				{ expireIn: 60 * 5 },
			);
		} catch (_err) {
			throw new PasswordResetError();
		}
	}

	/**
	 * Reset password with email and code
	 */
	async resetPasswordWithCode(
		email: string,
		code: string,
		passwordHash: string,
	): Promise<void> {
		try {
			// Retrieve the password reset code temporary key
			const value = await this.backend.get<{ code: string; userid: string }>(
				`passwordresetcode::${email}`,
			);
			// Check if code is the same
			if (value.metadata.code !== code) {
				throw new ValidationCodeError();
			}
			// Proceed with the update of the password and delete the temporary key
			await Promise.all([
				this.addSignInMethodPassword(
					value.metadata.userid,
					passwordHash,
				),
				this.backend.delete(`passwordresetcode::${email}`),
			]);
		} catch (_err) {
			throw new SetPasswordResetError();
		}
	}
}
