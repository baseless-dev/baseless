import {
	AuthIdentifier,
	IAuthProvider,
	IUser,
	PasswordResetCodeError,
	PasswordResetError,
	UserAlreadyExistsError,
	UserNotFoundError,
	ValidationCodeError,
} from "https://baseless.dev/x/baseless/core/auth.ts";
import {
	IKVProvider,
	KeyNotFoundError,
} from "https://baseless.dev/x/baseless/core/kv.ts";
import { autoid } from "https://baseless.dev/x/baseless/core/autoid.ts";

/**
 * Convert authid to key
 */
function useridToKey(userid: AuthIdentifier) {
	return `user::${userid}`;
}

/**
 * Auth object
 */
export class User<Metadata> implements IUser<Metadata> {
	constructor(
		public id: AuthIdentifier,
		public email: string | null,
		public emailConfirmed: boolean,
		public refreshTokenId: string,
		public metadata: Metadata,
	) {}
}

/**
 * Auth provider backed by an IKVProvider
 */
export class AuthOnKvProvider implements IAuthProvider {
	/**
	 * Construct an new AuthOnKvProvider backed by an IKVProvider
	 */
	constructor(protected backend: IKVProvider) {}

	/**
	 * Get the user of the auth identifier
	 */
	async getUser<Metadata>(userid: AuthIdentifier): Promise<IUser<Metadata>> {
		const key = useridToKey(userid);
		const value = await this.backend.get<
			Metadata & {
				email: string;
				emailConfirmed: boolean;
				refreshTokenId: string;
			}
		>(key);
		const { email, emailConfirmed, refreshTokenId, ...metadata } =
			value.metadata;
		return new User(
			userid,
			email,
			emailConfirmed,
			refreshTokenId,
			metadata as unknown as Metadata,
		);
	}

	/**
	 * Get the IUser by email
	 */
	async getUserByEmail<Metadata>(email: string): Promise<IUser<Metadata>> {
		try {
			const { metadata: { userid } } = await this.backend.get(
				`signin::password::${email}`,
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
	): Promise<IUser<Metadata>> {
		const userid = autoid();
		try {
			await this.getUser<Metadata>(userid);
			throw new UserAlreadyExistsError(userid);
		} catch (_) {
			const emailConfirmed = false;
			const refreshTokenId = autoid();
			return this.backend
				.set(useridToKey(userid), {
					...metadata,
					email,
					emailConfirmed,
					refreshTokenId,
				})
				.then(() =>
					new User(userid, email, emailConfirmed, refreshTokenId, metadata)
				);
		}
	}

	/**
	 * Update an IAuth
	 */
	async updateUser<Metadata>(
		userid: string,
		metadata: Partial<Metadata>,
		email?: string,
		emailConfirmed?: boolean,
		refreshTokenId?: string,
	): Promise<void> {
		const key = useridToKey(userid);
		const user = await this.getUser<Metadata>(userid);
		return this.backend.set(key, {
			...user.metadata,
			...metadata,
			email: email ?? user.email,
			emailConfirmed: emailConfirmed ?? user.emailConfirmed,
			refreshTokenId: refreshTokenId ?? user.refreshTokenId,
		});
	}

	/**
	 * Delete an IAuth
	 */
	deleteUser(userid: AuthIdentifier): Promise<void> {
		const key = useridToKey(userid);
		return this.backend.delete(key);
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
		email: string,
		passwordHash: string,
	): Promise<void> {
		await Promise.all([
			this.backend.set(`usermethod::${userid}::password`, {}),
			this.backend.set(`signin::password::${email}`, {
				passwordHash,
				userid: userid,
			}),
		]);
	}

	/**
	 * Sign-in with email and passwordHash
	 */
	async signInWithEmailPassword<Metadata>(
		email: string,
		passwordHash: string,
	): Promise<IUser<Metadata>> {
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
		} catch (err) {
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
		} catch (err) {
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
		} catch (_) {
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
					email,
					passwordHash,
				),
				this.backend.delete(`passwordresetcode::${email}`),
			]);
		} catch (err) {
			throw new PasswordResetCodeError();
		}
	}
}
