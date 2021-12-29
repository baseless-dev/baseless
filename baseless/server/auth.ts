import { SignJWT } from "https://deno.land/x/jose@v4.3.7/index.ts";
import { AuthDescriptor, IAuthService, IUser } from "../core/auth.ts";
import { Client } from "../core/clients.ts";
import { IMailService } from "../core/mail.ts";
import { IContext } from "../core/context.ts";
import { Result } from "./schema.ts";
import { autoid } from "../core/autoid.ts";
import { ServerData } from "../server.ts";

export class AuthController {
	public constructor(
		private data: ServerData,
	) {}

	private _getMessageTemplate(
		type: keyof AuthDescriptor["templates"],
		locale: string,
	) {
		const templates = this.data.authDescriptor.templates;
		for (const key of [locale, "en"]) {
			if (templates[type].has(key)) {
				return templates[type].get(key)!;
			}
		}
	}

	private async _sendValidationEmailTo(
		authService: IAuthService,
		mailService: IMailService,
		client: Client,
		locale: string,
		to: string,
	) {
		const code = autoid(40);
		const tpl = this._getMessageTemplate("validation", locale);
		await authService.setEmailValidationCode(to, code);
		if (tpl) {
			const link = tpl.link + `?code=${code}`;
			await mailService.send({
				to,
				subject: tpl.subject
					.replace(/%APP_NAME%/g, client.principal)
					.replace(/%LINK%/g, link),
				text: tpl.text
					.replace(/%APP_NAME%/g, client.principal)
					.replace(/%LINK%/g, link),
				html: (tpl.html && tpl.html
					.replace(/%APP_NAME%/g, client.principal)
					.replace(/%LINK%/g, link)) ?? undefined,
			});
		} else {
			console.error(
				`Could not find validation template for locale "${locale}". Validation code is "${code}".`,
			);
			this.data.logger.error(
				`Could not find validation template for locale "${locale}". Validation code is "${code}".`,
			);
		}
	}

	private async _createJWTs(
		context: IContext,
		user: IUser<unknown>,
	): Promise<{ access_token: string; refresh_token: string }> {
		const { algKey, privateKey } = this.data;
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
		context: IContext,
		locale: string,
		email: string,
	): Promise<Result> {
		const user = await context.auth.getUserByEmail(email);
		if (!user.email || user.emailConfirmed) {
			return { error: "NotAllowed" };
		}
		context.waitUntil(this._sendValidationEmailTo(
			context.auth,
			context.mail,
			context.client,
			locale,
			user.email,
		));
		return {};
	}

	public async validateEmailWithCode(
		_request: Request,
		context: IContext,
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
		context: IContext,
		locale: string,
		email: string,
	): Promise<Result> {
		const code = autoid(40);
		const tpl = this._getMessageTemplate("passwordReset", locale);
		await context.auth.setPasswordResetCode(email, code);
		if (tpl) {
			const link = tpl.link + `?code=${code}`;
			context.waitUntil(context.mail.send({
				to: email,
				subject: tpl.subject
					.replace(/%APP_NAME%/g, context.client.principal)
					.replace(/%LINK%/g, link),
				text: tpl.text
					.replace(/%APP_NAME%/g, context.client.principal)
					.replace(/%LINK%/g, link),
				html: (tpl.html && tpl.html
					.replace(/%APP_NAME%/g, context.client.principal)
					.replace(/%LINK%/g, link)) ?? undefined,
			}));
		} else {
			console.error(
				`Could not find password reset template for locale "${locale}". Reset password code is "${code}".`,
			);
			this.data.logger.error(
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
		context: IContext,
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
		context: IContext,
	): Promise<Result> {
		const { authDescriptor } = this.data;
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
		context: IContext,
		locale: string,
		email: string,
		password: string,
	): Promise<Result> {
		const { authDescriptor } = this.data;
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
		context.waitUntil(this._sendValidationEmailTo(
			context.auth,
			context.mail,
			context.client,
			locale,
			email,
		));
		if (authDescriptor.onUpdateUser) {
			context.waitUntil(authDescriptor.onUpdateUser(context, user));
		}
		return {};
	}

	public async createUserWithEmail(
		_request: Request,
		context: IContext,
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
			context.waitUntil(this._sendValidationEmailTo(
				context.auth,
				context.mail,
				context.client,
				locale,
				email,
			));
			const { authDescriptor } = this.data;
			if (authDescriptor.onCreateUser) {
				context.waitUntil(authDescriptor.onCreateUser(context, user));
			}
			return {};
		}
	}

	public async signWithEmailPassword(
		_request: Request,
		context: IContext,
		email: string,
		password: string,
	): Promise<Result> {
		const { authDescriptor } = this.data;
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
			this.data.logger.error(_err);
			return { error: "NotAllowed" };
		}
	}
}
