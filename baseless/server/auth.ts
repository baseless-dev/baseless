import { Logger } from "https://deno.land/std@0.118.0/log/mod.ts";
import { KeyLike, SignJWT } from "https://deno.land/x/jose@v4.3.7/index.ts";
import { AuthDescriptor, IAuthService, IUser } from "../core/auth.ts";
import { autoid } from "../core/autoid.ts";
import { Client } from "../core/clients.ts";
import { IContext } from "../core/context.ts";
import { IMailService } from "../core/mail.ts";
import { Result } from "./schema.ts";

/**
 * Hash password with SHA-512
 */
export async function hashPassword(password: string) {
	const buffer = new TextEncoder().encode(password);
	const hash = await crypto.subtle.digest({ name: "SHA-512" }, buffer);
	return new TextDecoder().decode(hash);
}

export default ({
	logger,
	authDescriptor,
	algKey,
	publicKey,
	privateKey,
}: {
	logger: Logger;
	authDescriptor: AuthDescriptor;
	algKey: string;
	publicKey: KeyLike;
	privateKey: KeyLike;
}) => {
	function getMessageTemplate(
		type: keyof AuthDescriptor["templates"],
		locale: string,
	) {
		for (const key of [locale, "en"]) {
			if (authDescriptor.templates[type].has(key)) {
				return authDescriptor.templates[type].get(key)!;
			}
		}
	}

	async function sendVerificationEmailTo(
		authService: IAuthService,
		mailService: IMailService,
		client: Client,
		locale: string,
		to: string,
	) {
		const code = autoid(40);
		const tpl = getMessageTemplate("verification", locale);
		await authService.setEmailValidationCode(to, code);
		if (tpl) {
			const link = tpl.link + `?code=${code}`;
			await mailService.send({
				to,
				subject: tpl.subject
					.replace("%APP_NAME%", client.principal)
					.replace("%LINK%", link),
				text: tpl.text
					.replace("%APP_NAME%", client.principal)
					.replace("%LINK%", link),
				html: (tpl.html && tpl.html
					.replace("%APP_NAME%", client.principal)
					.replace("%LINK%", link)) ?? undefined,
			});
		} else {
			logger.error(
				`Could not find validation template for locale "${locale}". Validation code is "${code}".`,
			);
		}
	}

	async function createJWTs(
		context: IContext,
		user: IUser<unknown>,
	): Promise<{ access_token: string; refresh_token: string }> {
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

	return {
		async sendVerificationEmail(
			_request: Request,
			context: IContext,
			locale: string,
			email: string,
		): Promise<Result> {
			const user = await context.auth.getUserByEmail(email);
			if (!user.email || user.emailConfirmed) {
				return { error: "NotAllowed" };
			}
			context.waitUntil(sendVerificationEmailTo(
				context.auth,
				context.mail,
				context.client,
				locale,
				user.email,
			));
			return {};
		},
		async validateEmailWithCode(
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
		},
		async sendPasswordResetEmail(
			_request: Request,
			context: IContext,
			locale: string,
			email: string,
		): Promise<Result> {
			const code = autoid(40);
			const tpl = getMessageTemplate("passwordReset", locale);
			await context.auth.setPasswordResetCode(email, code);
			if (tpl) {
				const link = tpl.link + `?code=${code}`;
				context.waitUntil(context.mail.send({
					to: email,
					subject: tpl.subject
						.replace("%APP_NAME%", context.client.principal)
						.replace("%LINK%", link),
					text: tpl.text
						.replace("%APP_NAME%", context.client.principal)
						.replace("%LINK%", link),
					html: (tpl.html && tpl.html
						.replace("%APP_NAME%", context.client.principal)
						.replace("%LINK%", link)) ?? undefined,
				}));
			} else {
				logger.error(
					`Could not find password reset template for locale "${locale}". Reset password code is "${code}".`,
				);
			}
			return {};
		},
		async resetPasswordWithCode(
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
					await hashPassword(password),
				);
				return {};
			} catch (err) {
				return { error: `${err}` };
			}
		},
		async createAnonymousUser(
			_request: Request,
			context: IContext,
		): Promise<Result> {
			if (!authDescriptor.allowAnonymousUser) {
				return { error: "METHOD_NOT_ALLOWED" };
			}
			const user = await context.auth.createUser(null, {});
			if (authDescriptor.onCreateUser) {
				context.waitUntil(authDescriptor.onCreateUser(context, user));
			}
			return await createJWTs(context, user);
		},
		async addSignWithEmailPassword(
			_request: Request,
			context: IContext,
			locale: string,
			email: string,
			password: string,
		): Promise<Result> {
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
				await hashPassword(password),
			);
			context.waitUntil(sendVerificationEmailTo(
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
		},
		async createUserWithEmail(
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
					await hashPassword(password),
				);
				context.waitUntil(sendVerificationEmailTo(
					context.auth,
					context.mail,
					context.client,
					locale,
					email,
				));
				if (authDescriptor.onCreateUser) {
					context.waitUntil(authDescriptor.onCreateUser(context, user));
				}
				return {};
			}
		},
		async signWithEmailPassword(
			_request: Request,
			context: IContext,
			email: string,
			password: string,
		): Promise<Result> {
			if (!authDescriptor.allowSignMethodPassword) {
				return { error: "NotAllowed" };
			}
			try {
				const passwordHash = await hashPassword(password);
				const user = await context.auth.signInWithEmailPassword(
					email,
					passwordHash,
				);
				if (!user.emailConfirmed) {
					return { error: "AuthEmailNotConfirmed" };
				}
				return await createJWTs(context, user);
			} catch (_err) {
				return { error: "NotAllowed" };
			}
		},
	};
};
