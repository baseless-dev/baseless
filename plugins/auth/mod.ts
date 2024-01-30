import { jwtVerify, type KeyLike, t, type TSchema } from "../../deps.ts";
import {
	MissingRefreshTokenError,
	UnauthorizedError,
} from "../../lib/auth/errors.ts";
import { simplify } from "../../lib/auth/simplify.ts";
import {
	type AuthenticationCeremonyComponent,
	AuthenticationConfirmResultSchema,
	AuthenticationSendResultSchema,
	AuthenticationSignInResponseSchema,
	type AuthenticationSignInState,
	sequence,
} from "../../lib/auth/types.ts";
import { assertAutoId, isAutoId } from "../../lib/autoid.ts";
import { createLogger } from "../../lib/logger.ts";
import { SESSION_AUTOID_PREFIX } from "../../lib/session/types.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { KVProvider } from "../../providers/kv.ts";
import type { SessionProvider } from "../../providers/session.ts";
import { AuthenticationService } from "./auth.ts";
import type { Context, TokenData } from "./context.ts";
import { createTokens } from "./create_tokens.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";
import { encryptAuthenticationCeremonyState } from "./encrypt_authentication_ceremony_state.ts";
import { IdentityService } from "./identity.ts";
import { SessionService } from "./session.ts";
import { Router } from "../../lib/router/router.ts";

export type AuthenticationKeys = {
	algo: string;
	privateKey: KeyLike;
	publicKey: KeyLike;
};

export type RateLimitOptions = {
	count: number;
	interval: number;
};

export type AuthenticationOptions = {
	prefix?: string;
	counter: CounterProvider;
	kv: KVProvider;
	identity: IdentityProvider;
	session: SessionProvider;
	keys: AuthenticationKeys;
	salt: string;
	ceremony: AuthenticationCeremonyComponent;
	rateLimit?: RateLimitOptions;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	allowAnonymousIdentity?: boolean;
	highRiskActionTimeWindow?: number;
};

const dataOrError = <T>(schema: TSchema): TSchema =>
	t.Union([
		t.Object({
			data: schema,
		}),
		t.Object({
			error: t.String({ description: "Error code" }),
		}, { $id: "AuthenticationErrorObject", description: "Error object" }),
	], {
		description: "Either an error object or the actual response",
	});

export const auth = (
	options: AuthenticationOptions,
) => {
	const logger = createLogger("auth-plugin");
	options.ceremony = simplify(
		sequence(options.ceremony, { kind: "done" as const }),
	);

	return new Router()
		.derive(async ({ request }) => {
			let authenticationToken: TokenData | undefined;
			if (request.headers.has("Authorization")) {
				const authorization = request.headers.get("Authorization") ?? "";
				const [, scheme, accessToken] =
					authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/) ?? [];
				if (scheme === "Bearer") {
					try {
						const { payload } = await jwtVerify(
							accessToken,
							options.keys.publicKey,
						);
						if (isAutoId(payload.sub, SESSION_AUTOID_PREFIX)) {
							const sessionData = await options.session.get(
								payload.sub,
							).catch((
								_,
							) => undefined);
							if (sessionData) {
								const { scope, aat } = { ...payload, scope: "", aat: 0 };
								authenticationToken = {
									lastAuthorizationTime: aat,
									scope: scope.split(/ +/),
									sessionData,
								};
							}
						} else {
							logger.warn(
								`Expected authorization JWT.sub to be an identity ID, got ${payload.sub}.`,
							);
						}
					} catch (error) {
						logger.warn(
							`Could not parse authorization header, got error : ${error}`,
						);
					}
				} else {
					logger.warn(`Unknown authorization scheme ${scheme}.`);
				}
			}

			const remoteAddress = request.headers.get("X-Real-Ip") ?? "";

			const context: Context = {
				get remoteAddress() {
					return remoteAddress;
				},
				get authenticationToken() {
					return authenticationToken;
				},
				get identity() {
					return new IdentityService(
						options.ceremony,
						options.identity,
						options.counter,
						options.kv,
						remoteAddress,
						options.rateLimit,
					);
				},
				get session() {
					return new SessionService(options.session);
				},
				get auth() {
					return new AuthenticationService(
						options.ceremony,
						options.identity,
						options.counter,
						options.rateLimit,
					);
				},
			};
			return context;
		})
		.post(
			"/sign-out",
			async ({ session, authenticationToken }) => {
				try {
					if (authenticationToken) {
						const sessionId = authenticationToken.sessionData.id;
						await session.destroy(sessionId).catch((_) => {});
						return Response.json({ data: { ok: true } });
					}
					return Response.json({ error: UnauthorizedError.name });
				} catch (error) {
					return Response.json({ error: error.name });
				}
			},
			{
				detail: {
					summary: "Sign out current session",
					tags: ["Authentication"],
				},
				headers: t.Object({
					"authorization": t.String(),
				}),
				response: {
					200: {
						description: "Sign out confirmation",
						content: {
							"application/json": {
								schema: dataOrError(t.Object({
									ok: t.Literal(true),
								})),
							},
						},
					},
				},
			},
		)
		.post(
			"/refresh-tokens",
			async ({ body, session, identity }) => {
				try {
					const refreshToken = body.refresh_token;
					if (!refreshToken) {
						return Response.json({ error: MissingRefreshTokenError.name });
					}
					const { payload } = await jwtVerify(
						refreshToken,
						options.keys.publicKey,
					);
					const { sub: sessionId, scope } = payload;
					assertAutoId(sessionId, SESSION_AUTOID_PREFIX);
					const sessionData = await session.get(sessionId);
					const id = await identity.get(sessionData.identityId);
					await session.update(
						sessionData,
						options.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
					);
					const { access_token, id_token } = await createTokens(
						id,
						sessionData,
						options.keys.algo,
						options.keys.privateKey,
						options.accessTokenTTL ?? 1000 * 60 * 10,
						options.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
						`${scope}`,
					);
					return Response.json({
						data: {
							access_token,
							id_token,
							refresh_token: refreshToken,
						},
					});
				} catch (error) {
					return Response.json({ error: error.name });
				}
			},
			{
				detail: {
					summary: "Get access token from refresh token",
					tags: ["Authentication"],
				},
				body: t.Object({
					"refresh_token": t.String(),
				}),
				response: {
					200: {
						description: "Refreshed tokens",
						content: {
							"application/json": {
								schema: dataOrError(t.Object({
									access_token: t.String(),
									id_token: t.String(),
									refresh_token: t.String(),
								})),
							},
						},
					},
				},
			},
		)
		.get("/sign-in/ceremony", async ({ auth }) => {
			try {
				const data = await auth.getSignInCeremony();
				return Response.json({ data });
			} catch (error) {
				return Response.json({ error: error.name });
			}
		}, {
			detail: {
				summary: "Get the authentication ceremony",
				tags: ["Authentication"],
			},
			response: {
				200: {
					description: "Authentication ceremony",
					content: {
						"application/json": {
							schema: dataOrError(AuthenticationSignInResponseSchema),
						},
					},
				},
			},
		})
		.post(
			"/sign-in/ceremony",
			async ({ body, auth }) => {
				try {
					const state = await decryptEncryptedAuthenticationCeremonyState(
						body.state,
						options.keys.publicKey,
					);
					if (state.kind !== "signin") {
						return Response.json({ error: UnauthorizedError.name });
					}
					const data = await auth.getSignInCeremony(state);
					return Response.json({ data });
				} catch (error) {
					return Response.json({ error: error.name });
				}
			},
			{
				detail: {
					summary: "Get the authentication ceremony from an encrypted state",
					tags: ["Authentication"],
				},
				body: t.Object({
					state: t.String({ description: "Encrypted state" }),
				}),
				response: {
					200: {
						description: "Authentication ceremony",
						content: {
							"application/json": {
								schema: dataOrError(AuthenticationSignInResponseSchema),
							},
						},
					},
				},
			},
		)
		.post(
			"/sign-in/submit-prompt",
			async ({ body, auth, remoteAddress, identity, session }) => {
				try {
					const state = await decryptEncryptedAuthenticationCeremonyState(
						body.state ?? "",
						options.keys.publicKey,
					);
					if (state.kind !== "signin") {
						return Response.json({ error: UnauthorizedError.name });
					}
					const subject = state.identity ? state.identity : remoteAddress;
					const result = await auth.submitSignInPrompt(
						state,
						body.component,
						body.prompt,
						subject,
					);
					if (result.done) {
						const id = await identity.get(result.identityId);
						// TODO session expiration
						const sessionData = await session.create(result.identityId, {});
						const { access_token, id_token, refresh_token } =
							await createTokens(
								id,
								sessionData,
								options.keys.algo,
								options.keys.privateKey,
								options.accessTokenTTL ?? 1000 * 60 * 10,
								options.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
							);
						return Response.json({
							done: true,
							access_token,
							id_token,
							refresh_token,
						});
					} else {
						const { state, ...rest } = result as (typeof result & {
							state?: AuthenticationSignInState;
						});
						return Response.json({
							data: {
								...rest,
								...(state
									? {
										encryptedState: await encryptAuthenticationCeremonyState(
											state,
											options.keys.algo,
											options.keys.privateKey,
										),
									}
									: {}),
							},
						});
					}
				} catch (error) {
					return Response.json({ error: error.name });
				}
			},
			{
				detail: {
					summary: "Submit sign in prompt",
					tags: ["Authentication"],
				},
				body: t.Object({
					component: t.String({ description: "The authentication component" }),
					prompt: t.Any(),
					state: t.String({ description: "Encrypted state" }),
				}),
				response: {
					200: {
						description: "Authentication ceremony",
						content: {
							"application/json": {
								schema: dataOrError(AuthenticationSignInResponseSchema),
							},
						},
					},
				},
			},
		)
		.post(
			"/sign-in/send-prompt",
			async ({ body, identity, authenticationToken }) => {
				try {
					const state = await decryptEncryptedAuthenticationCeremonyState(
						body.state ?? "",
						options.keys.publicKey,
					);
					if (state.kind !== "signin") {
						return Response.json({ error: UnauthorizedError.name });
					}
					const identityId = state.identity
						? state.identity
						: authenticationToken?.sessionData.identityId;
					if (!identityId) {
						return Response.json({ error: UnauthorizedError.name });
					}
					// TODO default locale
					const locale = body.locale?.toString() ?? "en";
					await identity.sendComponentPrompt(
						identityId,
						body.component,
						locale,
					);
					return Response.json({ data: { sent: true } });
				} catch (_error) {
					return Response.json({ data: { sent: false } });
				}
			},
			{
				detail: {
					summary: "Send sign in prompt",
					tags: ["Authentication"],
				},
				body: t.Object({
					component: t.String({ description: "The authentication component" }),
					state: t.String({ description: "Encrypted state" }),
					locale: t.String(),
				}),
				response: {
					200: {
						description: "Prompt sent confirmation",
						content: {
							"application/json": {
								schema: dataOrError(AuthenticationSendResultSchema),
							},
						},
					},
				},
			},
		)
		.post(
			"/sign-in/send-validation-code",
			async ({ body, authenticationToken, identity }) => {
				try {
					const state = await decryptEncryptedAuthenticationCeremonyState(
						body.state ?? "",
						options.keys.publicKey,
					);
					if (state.kind !== "signin") {
						return Response.json({ error: UnauthorizedError.name });
					}
					const identityId = state.identity
						? state.identity
						: authenticationToken?.sessionData.identityId;
					if (!identityId) {
						return Response.json({ error: UnauthorizedError.name });
					}
					// TODO default locale
					const locale = body.locale?.toString() ?? "en";
					await identity.sendComponentValidationCode(
						identityId,
						body.component,
						locale,
					);
					return Response.json({ data: { sent: true } });
				} catch (_error) {
					return Response.json({ data: { sent: false } });
				}
			},
			{
				detail: {
					summary: "Send validation code",
					tags: ["Authentication"],
				},
				body: t.Object({
					component: t.String({ description: "The authentication component" }),
					state: t.String({ description: "Encrypted state" }),
					locale: t.String(),
				}),
				response: {
					200: {
						description: "Validation code sent confirmation",
						content: {
							"application/json": {
								schema: dataOrError(AuthenticationSendResultSchema),
							},
						},
					},
				},
			},
		)
		.post(
			"/sign-in/submit-validation-code",
			async ({ body, identity }) => {
				try {
					await identity.confirmComponentValidationCode(body.code);
					return Response.json({ data: { confirmed: true } });
				} catch (_error) {
					return Response.json({ data: { confirmed: false } });
				}
			},
			{
				detail: {
					summary: "Submit validation code",
					tags: ["Authentication"],
				},
				body: t.Object({
					code: t.String(),
				}),
				response: {
					200: {
						description: "Validation code confirmation",
						content: {
							"application/json": {
								schema: dataOrError(AuthenticationConfirmResultSchema),
							},
						},
					},
				},
			},
		);
};

export default auth;
