import {
	AddSignInEmailPasswordError,
	AnonymousUserError,
	CreateUserError,
	EmailNeedsConfirmationError,
	PasswordResetError,
	RefreshTokensError,
	SetPasswordResetError,
	SetValidationCodeError,
	SignInEmailPasswordError,
	User,
	ValidationCodeError,
} from "https://baseless.dev/x/shared/auth.ts";
import { Context } from "https://baseless.dev/x/provider/context.ts";
import { Client } from "https://baseless.dev/x/provider/client.ts";
import { autoid } from "https://baseless.dev/x/shared/autoid.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.3.7/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.3.7/jwt/verify.ts";
import { Result } from "./schema.ts";
import { logger } from "https://baseless.dev/x/logger/mod.ts";

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

export class AuthController {
	protected logger = logger("server/AuthController");

	public constructor(
		private authDescriptor: AuthDescriptor,
	) {}

	private _getMessageTemplate(
		client: Client,
		type: keyof Exclude<Client["templates"], undefined>,
		locale: string,
	) {
		for (const key of [locale, "en"]) {
			if (client.templates?.[type][key]) {
				return client.templates[type][key]!;
			}
		}
	}

	private async _sendValidationEmailTo(
		context: Context,
		locale: string,
		to: string,
	) {
		const code = autoid(40);
		const template = this._getMessageTemplate(
			context.client,
			"validation",
			locale,
		);
		await context.auth.setEmailValidationCode(to, code);
		if (template) {
			const message = template(context, { code, email: to });
			context.waitUntil(context.mail.send({
				to,
				subject: message.subject,
				text: message.text,
				html: message.html,
			}));
		} else {
			this.logger.error(
				`Could not find validation template for locale "${locale}". Validation code is "${code}".`,
			);
		}
	}

	private async _createJWTs(
		context: Context,
		user: User<unknown>,
		scope = "*",
	): Promise<{ id_token: string; access_token: string; refresh_token: string }> {
		const { algKey, privateKey } = context.client;
		const id_token = await new SignJWT({
			email: user.email,
			metadata: user.metadata,
			emailConfirmed: user.emailConfirmed,
		})
			.setSubject(user.id)
			.setIssuedAt()
			.setExpirationTime("1week")
			.setIssuer(context.client.principal)
			.setAudience(context.client.principal)
			.setProtectedHeader({ alg: algKey })
			.sign(privateKey);
		const access_token = await new SignJWT({ scope })
			.setSubject(user.id)
			.setIssuedAt()
			.setExpirationTime("10sec")
			.setIssuer(context.client.principal)
			.setAudience(context.client.principal)
			.setProtectedHeader({ alg: algKey })
			.sign(privateKey);
		const refresh_token = await new SignJWT({ scope })
			.setSubject(user.id)
			.setIssuedAt()
			.setExpirationTime("2hour")
			.setIssuer(context.client.principal)
			.setAudience(context.client.principal)
			.setJti(user.refreshTokenId)
			.setProtectedHeader({ alg: algKey })
			.sign(privateKey);
		return { id_token, access_token, refresh_token };
	}

	public async sendValidationEmail(
		context: Context,
		locale: string,
		email: string,
	): Promise<Result> {
		try {
			const user = await context.auth.getUserByEmail(email);
			if (!user.email || user.emailConfirmed) {
				throw new SetValidationCodeError();
			}
			await this._sendValidationEmailTo(
				context,
				locale,
				user.email,
			);
			return {};
		} catch (err: unknown) {
			this.logger.error(`Could not send validation email, got ${err}`);
			throw new SetValidationCodeError();
		}
	}

	public async validateEmailWithCode(
		context: Context,
		email: string,
		code: string,
	): Promise<Result> {
		try {
			await context.auth.validateEmailWithCode(email, code);
			return {};
		} catch (err: unknown) {
			this.logger.error(`Could validate email with code, got ${err}`);
			throw new ValidationCodeError();
		}
	}

	public async sendPasswordResetEmail(
		context: Context,
		locale: string,
		email: string,
	): Promise<Result> {
		try {
			const code = autoid(40);
			const template = this._getMessageTemplate(
				context.client,
				"passwordReset",
				locale,
			);
			await context.auth.setPasswordResetCode(email, code);
			if (template) {
				const message = template(context, { code, email });
				context.waitUntil(context.mail.send({
					to: email,
					subject: message.subject,
					text: message.text,
					html: message.html,
				}));
			} else {
				this.logger.error(
					`Could not find password reset template for locale "${locale}". Reset password code is "${code}".`,
				);
			}
			return {};
		} catch (err: unknown) {
			this.logger.error(`Could send password reset, got ${err}`);
			throw new SetPasswordResetError();
		}
	}

	private async _hashPassword(password: string) {
		const buffer = new TextEncoder().encode(password);
		const hash = await crypto.subtle.digest({ name: "SHA-512" }, buffer);
		return btoa(String.fromCharCode(...new Uint8Array(hash)));
		// return new TextDecoder().decode(hash);
	}

	public async resetPasswordWithCode(
		context: Context,
		email: string,
		code: string,
		password: string,
	): Promise<Result> {
		try {
			await context.auth.resetPasswordWithCode(
				email,
				code,
				await this._hashPassword(password),
			);
			return {};
		} catch (err: unknown) {
			this.logger.error(`Could reset password, got ${err}`);
			throw new PasswordResetError();
		}
	}

	public async createAnonymousUser(
		context: Context,
	): Promise<Result> {
		try {
			const { authDescriptor } = this;
			if (!authDescriptor.allowAnonymousUser) {
				throw new AnonymousUserError();
			}
			const user = await context.auth.createUser(null, {});
			if (authDescriptor.onCreateUser) {
				context.waitUntil(authDescriptor.onCreateUser(context, user));
			}
			return await this._createJWTs(context, user);
		} catch (err: unknown) {
			this.logger.error(`Could create anonymous user, got ${err}`);
			throw new AnonymousUserError();
		}
	}

	public async addSignWithEmailPassword(
		context: Context,
		locale: string,
		email: string,
		password: string,
	): Promise<Result> {
		try {
			const { authDescriptor } = this;
			if (!authDescriptor.allowSignMethodPassword) {
				throw new AddSignInEmailPasswordError();
			}
			if (!context.currentUserId) {
				throw new AddSignInEmailPasswordError();
			}
			const user = await context.auth.getUser(context.currentUserId);
			if (!user.email) {
				await context.auth.updateUser(user.id, {}, email, undefined);
				user.email = email;
			}
			await context.auth.addSignInMethodPassword(
				user.id,
				user.email,
				await this._hashPassword(password),
			);
			await this._sendValidationEmailTo(
				context,
				locale,
				email,
			);
			if (authDescriptor.onUpdateUser) {
				context.waitUntil(authDescriptor.onUpdateUser(context, user));
			}
			return {};
		} catch (err: unknown) {
			this.logger.error(`Could add sign in method with email password, got ${err}`);
			throw new AddSignInEmailPasswordError();
		}
	}

	public async createUserWithEmail(
		context: Context,
		locale: string,
		email: string,
		password: string,
	): Promise<Result> {
		try {
			let user = await context.auth.getUserByEmail(email).catch((_) => undefined);
			if (user) {
				this.logger.warn(`User already exist for '${email}'.`);
				return {};
			}
			user = await context.auth.createUser(email, {});
			await context.auth.addSignInMethodPassword(
				user.id,
				email,
				await this._hashPassword(password),
			);
			await this._sendValidationEmailTo(
				context,
				locale,
				email,
			);
			const { authDescriptor } = this;
			if (authDescriptor.onCreateUser) {
				context.waitUntil(authDescriptor.onCreateUser(context, user));
			}
			return {};
		} catch (err: unknown) {
			this.logger.error(`Could create user, got ${err}`);
			throw new CreateUserError();
		}
	}

	public async signWithEmailPassword(
		context: Context,
		email: string,
		password: string,
	): Promise<Result> {
		const { authDescriptor } = this;
		if (!authDescriptor.allowSignMethodPassword) {
			this.logger.warn(`Sign in with email and password is not allowed.`);
			throw new SignInEmailPasswordError();
		}
		try {
			const passwordHash = await this._hashPassword(password);
			const user = await context.auth.signInWithEmailPassword(
				email,
				passwordHash,
			);
			if (!user.emailConfirmed) {
				this.logger.warn(`Email '${email}' is not confirmed.`);
				throw new EmailNeedsConfirmationError();
			}
			return await this._createJWTs(context, user);
		} catch (err: unknown) {
			this.logger.error(`Could sign in with email and password, got ${err}`);
			throw new SignInEmailPasswordError();
		}
	}

	public async refreshTokens(
		context: Context,
		refresh_token: string,
	): Promise<Result> {
		try {
			const { publicKey } = context.client;
			const { payload } = await jwtVerify(refresh_token, publicKey);
			const user = await context.auth.getUser(payload.sub!);
			return await this._createJWTs(context, user, `${payload.scope ?? "*"}`);
		} catch (err: unknown) {
			this.logger.error(`Could sign in with email and password, got ${err}`);
			throw new RefreshTokensError();
		}
	}
}
