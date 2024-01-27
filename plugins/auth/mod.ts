import {
	type Elysia,
	jwtVerify,
	type KeyLike,
	t,
	type TSchema,
} from "../../deps.ts";
import { UnauthorizedError } from "../../lib/auth/errors.ts";
import { simplify } from "../../lib/auth/simplify.ts";
import {
	type AuthenticationCeremonyComponent,
	sequence,
} from "../../lib/auth/types.ts";
import { isAutoId } from "../../lib/autoid.ts";
import { createLogger } from "../../lib/logger.ts";
import { SESSION_AUTOID_PREFIX } from "../../lib/session.ts";
import type { AuthenticationComponent } from "../../providers/auth_component.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { KVProvider } from "../../providers/kv.ts";
import type { SessionProvider } from "../../providers/session.ts";
import { AuthenticationService } from "./auth.ts";
import type { Context, TokenData } from "./context.ts";
import { IdentityService } from "./identity.ts";
import { SessionService } from "./session.ts";

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
	counter: CounterProvider;
	kv: KVProvider;
	identity: IdentityProvider;
	session: SessionProvider;
	keys: AuthenticationKeys;
	salt: string;
	ceremony: AuthenticationCeremonyComponent;
	components: AuthenticationComponent[];
	rateLimit?: RateLimitOptions;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	allowAnonymousIdentity?: boolean;
	highRiskActionTimeWindow?: number;
};

const wrapThrowable = async <T>(
	fn: () => T | Promise<T>,
): Promise<Response> => {
	try {
		return Response.json({ data: await fn() });
	} catch (error) {
		return Response.json({ error: error.name });
	}
};

const throwableSchema = <T>(schema: TSchema): TSchema =>
	t.Union([
		t.Object({
			data: schema,
		}, ["data"]),
		t.Object({
			error: t.String({ description: "Error code" }),
		}, { $id: "AuthenticationErrorObject", description: "Error object" }),
	], {
		description: "Either an error object or the actual response",
	});

export const auth = (
	options: AuthenticationOptions,
) =>
(app: Elysia) => {
	const logger = createLogger("auth-plugin");
	options.ceremony = simplify(
		sequence(options.ceremony, { kind: "done" as const }),
	);
	return app
		.derive(async ({ headers }) => {
			let authenticationToken: TokenData | undefined;
			if ("authorization" in headers) {
				const authorization = headers["authorization"] ?? "";
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

			const context: Context = {
				get remoteAddress() {
					return headers["x-real-ip"] ?? "";
				},
				get authenticationToken() {
					return authenticationToken;
				},
				get identity() {
					return new IdentityService(
						options,
						context,
					);
				},
				get session() {
					return new SessionService(options.session);
				},
				get auth() {
					return new AuthenticationService(options);
				},
			};
			return context;
		})
		.post(
			"/signOut",
			({ session, authenticationToken }) =>
				wrapThrowable(async () => {
					if (authenticationToken) {
						const sessionId = authenticationToken.sessionData.id;
						await session.destroy(sessionId).catch((_) => {});
						return { ok: true };
					}
					throw new UnauthorizedError();
				}),
			{
				detail: {
					summary: "Sign out current session",
					tags: ["Authentication"],
				},
				headers: t.Object({
					"authorization": t.String(),
				}),
				response: throwableSchema(t.Object({
					ok: t.Literal(true),
				})),
			},
		);
};

export default auth;

// 		.post(
// 			"/refresh",
// 			async ({ body, session, identity }) =>
// 				wrapThrowable(async () => {
// 					const refreshToken = body.refresh_token;
// 					if (!refreshToken) {
// 						throw new MissingRefreshTokenError();
// 					}
// 					const { payload } = await jwtVerify(
// 						refreshToken,
// 						options.keys.publicKey,
// 					);
// 					const { sub: sessionId, scope } = payload;
// 					assertAutoId(sessionId, SESSION_AUTOID_PREFIX);
// 					const sessionData = await session.get(sessionId);
// 					const id = await identity.get(sessionData.identityId);
// 					await session.update(
// 						sessionData,
// 						options.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
// 					);
// 					const { access_token, id_token } = await createTokens(
// 						id,
// 						sessionData,
// 						options.keys.algo,
// 						options.keys.privateKey,
// 						options.accessTokenTTL ?? 1000 * 60 * 10,
// 						options.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
// 						`${scope}`,
// 					);
// 					return {
// 						access_token,
// 						id_token,
// 						refresh_token: refreshToken,
// 					};
// 				}),
// 			{
// 				summary: "Get access token from refresh token",
// 				tags: ["Authentication"],
// 				body: t.Object({
// 					"refresh_token": t.String(),
// 				}, ["refresh_token"]),
// 				response: {
// 					200: {
// 						description: "Tokens",
// 						content: {
// 							"application/json": {
// 								schema: throwableSchema(t.Object({
// 									access_token: t.String(),
// 									id_token: t.String(),
// 									refresh_token: t.String(),
// 								}, ["access_token", "id_token", "refresh_token"])),
// 							},
// 						},
// 					},
// 				},
// 			},
// 		)
// 		.get("/ceremony", async ({ auth }) =>
// 			wrapThrowable(async () => {
// 				return await auth.getAuthenticationCeremony();
// 			}), {
// 			summary: "Get the authentication ceremony",
// 			tags: ["Authentication"],
// 			response: {
// 				200: {
// 					description: "Tokens",
// 					content: {
// 						"application/json": {
// 							schema: throwableSchema(t.Any()),
// 						},
// 					},
// 				},
// 			},
// 		})
// 		.post("/ceremony", async ({ body, auth }) =>
// 			wrapThrowable(async () => {
// 				const state = await decryptEncryptedAuthenticationCeremonyState(
// 					body.state,
// 					options.keys.publicKey,
// 				);
// 				return await auth.getAuthenticationCeremony(state);
// 			}), {
// 			summary: "Get the authentication ceremony from an encrypted state",
// 			tags: ["Authentication"],
// 			body: t.Object({
// 				state: AuthenticationEncryptedStateSchema,
// 			}, ["state"]),
// 			response: {
// 				200: {
// 					description: "Tokens",
// 					content: {
// 						"application/json": {
// 							schema: throwableSchema(t.Any()),
// 						},
// 					},
// 				},
// 			},
// 		})
// 		.post(
// 			"/signIn/submitPrompt",
// 			async ({ body, auth, remoteAddress, identity, session }) =>
// 				wrapThrowable(async () => {
// 					const state = await decryptEncryptedAuthenticationCeremonyState(
// 						body.state ?? "",
// 						options.keys.publicKey,
// 					);
// 					const subject = isAuthenticationCeremonyStateIdentified(state)
// 						? state.identity
// 						: remoteAddress;
// 					const result = await auth.submitComponentPrompt(
// 						state,
// 						body.component,
// 						body.prompt,
// 						subject,
// 					);
// 					if (isAuthenticationCeremonyResponseDone(result)) {
// 						const id = await identity.get(result.identityId);
// 						// TODO session expiration
// 						const sessionData = await session.create(result.identityId, {});
// 						const { access_token, id_token, refresh_token } =
// 							await createTokens(
// 								id,
// 								sessionData,
// 								options.keys.algo,
// 								options.keys.privateKey,
// 								options.accessTokenTTL ?? 1000 * 60 * 10,
// 								options.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
// 							);
// 						return {
// 							done: true,
// 							access_token,
// 							id_token,
// 							refresh_token,
// 						};
// 					} else {
// 						const { state, ...rest } = result as (typeof result & {
// 							state?: AuthenticationCeremonyState;
// 						});
// 						return {
// 							...rest,
// 							...(state
// 								? {
// 									encryptedState: await encryptAuthenticationCeremonyState(
// 										state,
// 										options.keys.algo,
// 										options.keys.privateKey,
// 									),
// 								}
// 								: {}),
// 						};
// 					}
// 				}),
// 			{
// 				summary: "Submit sign in prompt",
// 				tags: ["Authentication"],
// 				body: t.Object({
// 					component: t.Describe("The authentication component", t.String()),
// 					prompt: t.Any(),
// 					state: AuthenticationEncryptedStateSchema,
// 				}, ["component", "prompt"]),
// 				response: {
// 					200: {
// 						description: "Sign in result",
// 						content: {
// 							"application/json": {
// 								schema: throwableSchema(t.Any()),
// 							},
// 						},
// 					},
// 				},
// 			},
// 		)
// 		.post(
// 			"/signIn/sendPrompt",
// 			async ({ body, identity, authenticationToken }) =>
// 				wrapThrowable(async () => {
// 					try {
// 						const state = await decryptEncryptedAuthenticationCeremonyState(
// 							body.state ?? "",
// 							options.keys.publicKey,
// 						);
// 						const identityId = isAuthenticationCeremonyStateIdentified(state)
// 							? state.identity
// 							: authenticationToken?.sessionData.identityId;
// 						if (!identityId) {
// 							return new UnauthorizedError();
// 						}
// 						// TODO default locale
// 						const locale = body.locale?.toString() ?? "en";
// 						await identity.sendComponentPrompt(
// 							identityId,
// 							body.component,
// 							locale,
// 						);
// 						return { sent: true };
// 					} catch (_error) {
// 						return { sent: false };
// 					}
// 				}),
// 			{
// 				summary: "Send sign in prompt",
// 				tags: ["Authentication"],
// 				body: t.Object({
// 					component: t.Describe("The authentication component", t.String()),
// 					state: AuthenticationEncryptedStateSchema,
// 					locale: t.String(),
// 				}, ["component"]),
// 				response: {
// 					200: {
// 						description: "Send sign in prompt result",
// 						content: {
// 							"application/json": {
// 								schema: throwableSchema(t.Object({
// 									sent: t.Boolean(),
// 								}, ["sent"])),
// 							},
// 						},
// 					},
// 				},
// 			},
// 		)
// 		.post(
// 			"/component/sendValidationCode",
// 			async ({ body, authenticationToken, identity }) =>
// 				wrapThrowable(async () => {
// 					try {
// 						const state = await decryptEncryptedAuthenticationCeremonyState(
// 							body.state ?? "",
// 							options.keys.publicKey,
// 						);
// 						const identityId = isAuthenticationCeremonyStateIdentified(state)
// 							? state.identity
// 							: authenticationToken?.sessionData.identityId;
// 						if (!identityId) {
// 							throw new UnauthorizedError();
// 						}
// 						// TODO default locale
// 						const locale = body.locale?.toString() ?? "en";
// 						await identity.sendComponentValidationCode(
// 							identityId,
// 							body.component,
// 							locale,
// 						);
// 						return { sent: true };
// 					} catch (_error) {
// 						return { sent: false };
// 					}
// 				}),
// 			{
// 				summary: "Send validation code",
// 				tags: ["Authentication"],
// 				body: t.Object({
// 					component: t.Describe("The authentication component", t.String()),
// 					state: AuthenticationEncryptedStateSchema,
// 					locale: t.String(),
// 				}, ["component"]),
// 				response: {
// 					200: {
// 						description: "Send validation code result",
// 						content: {
// 							"application/json": {
// 								schema: throwableSchema(t.Object({
// 									sent: t.Boolean(),
// 								}, ["sent"])),
// 							},
// 						},
// 					},
// 				},
// 			},
// 		)
// 		.post(
// 			"/component/submitValidationCode",
// 			async ({ body, identity }) =>
// 				wrapThrowable(async () => {
// 					try {
// 						await identity.confirmComponentValidationCode(body.code);
// 						return { confirmed: true };
// 					} catch (_error) {
// 						return { confirmed: false };
// 					}
// 				}),
// 			{
// 				summary: "Submit validation code",
// 				tags: ["Authentication"],
// 				body: t.Object({
// 					code: t.String(),
// 				}, ["code"]),
// 				response: {
// 					200: {
// 						description: "Submit validation code result",
// 						content: {
// 							"application/json": {
// 								schema: throwableSchema(t.Object({
// 									confirmed: t.Boolean(),
// 								}, ["confirmed"])),
// 							},
// 						},
// 					},
// 				},
// 			},
// 		);
// }
