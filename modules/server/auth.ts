import { User } from "https://baseless.dev/x/shared/deno/auth.ts";
import { Context } from "https://baseless.dev/x/provider/deno/context.ts";
import { Client } from "https://baseless.dev/x/provider/deno/client.ts";
import { autoid } from "https://baseless.dev/x/shared/deno/autoid.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.3.7/jwt/sign.ts";
import { Result } from "./schema.ts";
import { logger } from "https://baseless.dev/x/logger/deno/mod.ts";

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
			const message = template(context, { code });
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
	): Promise<{ access_token: string; refresh_token: string }> {
		const { algKey, privateKey } = context.client;
		const access_token = await new SignJWT({ scope: "*" })
			.setSubject(user.id)
			.setExpirationTime("15min")
			.setIssuer(context.client.principal)
			.setAudience(context.client.principal)
			.setProtectedHeader({ alg: algKey })
			.sign(privateKey);
		const refresh_token = await new SignJWT({ scope: "*" })
			.setSubject(user.id)
			.setExpirationTime("1week")
			.setIssuer(context.client.principal)
			.setAudience(context.client.principal)
			.setJti(user.refreshTokenId)
			.setProtectedHeader({ alg: algKey })
			.sign(privateKey);
		return { access_token, refresh_token };
	}

	public async sendValidationEmail(
		_request: Request,
		context: Context,
		locale: string,
		email: string,
	): Promise<Result> {
		const user = await context.auth.getUserByEmail(email);
		if (!user.email || user.emailConfirmed) {
			return { error: "NotAllowed" };
		}
		await this._sendValidationEmailTo(
			context,
			locale,
			user.email,
		);
		return {};
	}

	public async validateEmailWithCode(
		_request: Request,
		context: Context,
		email: string,
		code: string,
	): Promise<Result> {
		try {
			await context.auth.validateEmailWithCode(email, code);
			return {};
		} catch (err) {
			return { error: `${err}` };
		}
	}

	public async sendPasswordResetEmail(
		_request: Request,
		context: Context,
		locale: string,
		email: string,
	): Promise<Result> {
		const code = autoid(40);
		const template = this._getMessageTemplate(
			context.client,
			"passwordReset",
			locale,
		);
		await context.auth.setPasswordResetCode(email, code);
		if (template) {
			const message = template(context, { code });
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
	}

	private async _hashPassword(password: string) {
		const buffer = new TextEncoder().encode(password);
		const hash = await crypto.subtle.digest({ name: "SHA-512" }, buffer);
		return btoa(String.fromCharCode(...new Uint8Array(hash)));
		// return new TextDecoder().decode(hash);
	}

	public async resetPasswordWithCode(
		_request: Request,
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
		} catch (err) {
			return { error: `${err}` };
		}
	}

	public async createAnonymousUser(
		_request: Request,
		context: Context,
	): Promise<Result> {
		const { authDescriptor } = this;
		if (!authDescriptor.allowAnonymousUser) {
			return { error: "METHOD_NOT_ALLOWED" };
		}
		const user = await context.auth.createUser(null, {});
		if (authDescriptor.onCreateUser) {
			context.waitUntil(authDescriptor.onCreateUser(context, user));
		}
		return await this._createJWTs(context, user);
	}

	public async addSignWithEmailPassword(
		_request: Request,
		context: Context,
		locale: string,
		email: string,
		password: string,
	): Promise<Result> {
		const { authDescriptor } = this;
		if (!authDescriptor.allowSignMethodPassword) {
			return { error: "METHOD_NOT_ALLOWED" };
		}
		if (!context.currentUserId) {
			return { error: "UNAUTHORIZED" };
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
	}

	public async createUserWithEmail(
		_request: Request,
		context: Context,
		locale: string,
		email: string,
		password: string,
	): Promise<Result> {
		try {
			const _user = await context.auth.getUserByEmail(email);
			return {};
		} catch (_err) {
			const user = await context.auth.createUser(email, {});
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
		}
	}

	public async signWithEmailPassword(
		_request: Request,
		context: Context,
		email: string,
		password: string,
	): Promise<Result> {
		const { authDescriptor } = this;
		if (!authDescriptor.allowSignMethodPassword) {
			return { error: "NotAllowed" };
		}
		try {
			const passwordHash = await this._hashPassword(password);
			const user = await context.auth.signInWithEmailPassword(
				email,
				passwordHash,
			);
			if (!user.emailConfirmed) {
				return { error: "AuthEmailNotConfirmed" };
			}
			return await this._createJWTs(context, user);
		} catch (_err) {
			this.logger.error(_err);
			return { error: "NotAllowed" };
		}
	}
}
