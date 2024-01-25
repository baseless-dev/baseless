import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";
import type { AuthenticationCeremonyComponent } from "../../common/auth/ceremony/ceremony.ts";
import { Router } from "../../common/router/router.ts";
import { SESSION_AUTOID_PREFIX } from "../../common/session/data.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { SessionProvider } from "../../providers/session.ts";
import { createLogger } from "../../common/system/logger.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import { assertAutoId, isAutoId } from "../../common/system/autoid.ts";
import { AuthenticationService } from "./auth.ts";
import { IdentityService } from "./identity.ts";
import { SessionService } from "./session.ts";
import type { AuthenticationComponent } from "../../common/auth/component.ts";
import { t } from "../../common/schema/types.ts";
import type { Context, TokenData } from "./context.ts";
import type { CounterProvider } from "../../providers/counter.ts";
import type { KVProvider } from "../../providers/kv.ts";
import {
	MissingRefreshTokenError,
	UnauthorizedError,
} from "../../common/auth/errors.ts";
import { createTokens } from "./create_tokens.ts";
import { isAuthenticationCeremonyResponseDone } from "../../common/auth/ceremony/response.ts";
import {
	type AuthenticationCeremonyState,
	isAuthenticationCeremonyStateIdentified,
} from "../../common/auth/ceremony/state.ts";
import { encryptAuthenticationCeremonyState } from "./encrypt_authentication_ceremony_state.ts";
import { simplify } from "../../common/auth/ceremony/component/simplify.ts";
import { sequence } from "../../common/auth/ceremony/component/helpers.ts";

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

const AuthenticationEncryptedStateSchema = t.Referenceable(
	"AuthenticationEncryptedState",
	t.Describe("An authentication encrypted state", t.String()),
);

const wrapThrowable = async <T>(
	fn: () => T | Promise<T>,
): Promise<Response> => {
	try {
		return Response.json({ data: await fn() });
	} catch (error) {
		return Response.json({ error: error.name });
	}
};

const throwableSchema = <T>(schema: t.Schema): t.Schema =>
	t.Union(
		t.Object({
			data: schema,
		}, ["data"]),
		t.Object({
			error: t.String(),
		}, ["error"]),
	);

// deno-lint-ignore explicit-function-return-type
export default function authPlugin(
	options: AuthenticationOptions,
) {
	const logger = createLogger("auth-plugin");
	options.ceremony = simplify(
		sequence(options.ceremony, { kind: "done" as const }),
	);
	return new Router()
		.decorate(async ({ request }) => {
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

			const context: Context = {
				get remoteAddress() {
					return request.headers.get("X-Real-Ip") ?? "";
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
			async ({ session, authenticationToken }) =>
				wrapThrowable(async () => {
					if (authenticationToken) {
						const sessionId = authenticationToken.sessionData.id;
						await session.destroy(sessionId).catch((_) => {});
						return { ok: true };
					}
					throw new UnauthorizedError();
				}),
			{
				summary: "Sign out current session",
				tags: ["Authentication"],
				headers: t.Object({
					"authorization": t.String(),
				}, ["authorization"]),
				response: {
					200: {
						description: "Confirmation",
						content: {
							"application/json": {
								schema: throwableSchema(t.Object({
									ok: t.Const(true),
								}, ["ok"])),
							},
						},
					},
				},
			},
		)
		.post(
			"/refresh",
			async ({ body, session, identity }) =>
				wrapThrowable(async () => {
					const refreshToken = body.refresh_token;
					if (!refreshToken) {
						throw new MissingRefreshTokenError();
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
					return {
						access_token,
						id_token,
						refresh_token: refreshToken,
					};
				}),
			{
				summary: "Get access token from refresh token",
				tags: ["Authentication"],
				body: t.Object({
					"refresh_token": t.String(),
				}, ["refresh_token"]),
				response: {
					200: {
						description: "Tokens",
						content: {
							"application/json": {
								schema: throwableSchema(t.Object({
									access_token: t.String(),
									id_token: t.String(),
									refresh_token: t.String(),
								}, ["access_token", "id_token", "refresh_token"])),
							},
						},
					},
				},
			},
		)
		.get("/ceremony", async ({ auth }) =>
			wrapThrowable(async () => {
				return await auth.getAuthenticationCeremony();
			}), {
			summary: "Get the authentication ceremony",
			tags: ["Authentication"],
			response: {
				200: {
					description: "Tokens",
					content: {
						"application/json": {
							schema: throwableSchema(t.Any()),
						},
					},
				},
			},
		})
		.post("/ceremony", async ({ body, auth }) =>
			wrapThrowable(async () => {
				const state = await decryptEncryptedAuthenticationCeremonyState(
					body.state,
					options.keys.publicKey,
				);
				return await auth.getAuthenticationCeremony(state);
			}), {
			summary: "Get the authentication ceremony from an encrypted state",
			tags: ["Authentication"],
			body: t.Object({
				state: AuthenticationEncryptedStateSchema,
			}, ["state"]),
			response: {
				200: {
					description: "Tokens",
					content: {
						"application/json": {
							schema: throwableSchema(t.Any()),
						},
					},
				},
			},
		})
		.post(
			"/signIn/submitPrompt",
			async ({ body, auth, remoteAddress, identity, session }) =>
				wrapThrowable(async () => {
					const state = await decryptEncryptedAuthenticationCeremonyState(
						body.state ?? "",
						options.keys.publicKey,
					);
					const subject = isAuthenticationCeremonyStateIdentified(state)
						? state.identity
						: remoteAddress;
					const result = await auth.submitComponentPrompt(
						state,
						body.component,
						body.prompt,
						subject,
					);
					if (isAuthenticationCeremonyResponseDone(result)) {
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
						return {
							done: true,
							access_token,
							id_token,
							refresh_token,
						};
					} else {
						const { state, ...rest } = result as (typeof result & {
							state?: AuthenticationCeremonyState;
						});
						return {
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
						};
					}
				}),
			{
				summary: "Submit sign in prompt",
				tags: ["Authentication"],
				body: t.Object({
					component: t.Describe("The authentication component", t.String()),
					prompt: t.Any(),
					state: AuthenticationEncryptedStateSchema,
				}, ["component", "prompt"]),
				response: {
					200: {
						description: "Sign in result",
						content: {
							"application/json": {
								schema: throwableSchema(t.Any()),
							},
						},
					},
				},
			},
		)
		.post(
			"/signIn/sendPrompt",
			async ({ body, identity, authenticationToken }) =>
				wrapThrowable(async () => {
					try {
						const state = await decryptEncryptedAuthenticationCeremonyState(
							body.state ?? "",
							options.keys.publicKey,
						);
						const identityId = isAuthenticationCeremonyStateIdentified(state)
							? state.identity
							: authenticationToken?.sessionData.identityId;
						if (!identityId) {
							return new UnauthorizedError();
						}
						// TODO default locale
						const locale = body.locale?.toString() ?? "en";
						await identity.sendComponentPrompt(
							identityId,
							body.component,
							locale,
						);
						return { sent: true };
					} catch (_error) {
						return { sent: false };
					}
				}),
			{
				summary: "Send sign in prompt",
				tags: ["Authentication"],
				body: t.Object({
					component: t.Describe("The authentication component", t.String()),
					state: AuthenticationEncryptedStateSchema,
					locale: t.String(),
				}, ["component"]),
				response: {
					200: {
						description: "Send sign in prompt result",
						content: {
							"application/json": {
								schema: throwableSchema(t.Object({
									sent: t.Boolean(),
								}, ["sent"])),
							},
						},
					},
				},
			},
		)
		.post(
			"/component/sendValidationCode",
			async ({ body, authenticationToken, identity }) =>
				wrapThrowable(async () => {
					try {
						const state = await decryptEncryptedAuthenticationCeremonyState(
							body.state ?? "",
							options.keys.publicKey,
						);
						const identityId = isAuthenticationCeremonyStateIdentified(state)
							? state.identity
							: authenticationToken?.sessionData.identityId;
						if (!identityId) {
							throw new UnauthorizedError();
						}
						// TODO default locale
						const locale = body.locale?.toString() ?? "en";
						await identity.sendComponentValidationCode(
							identityId,
							body.component,
							locale,
						);
						return { sent: true };
					} catch (_error) {
						return { sent: false };
					}
				}),
			{
				summary: "Send validation code",
				tags: ["Authentication"],
				body: t.Object({
					component: t.Describe("The authentication component", t.String()),
					state: AuthenticationEncryptedStateSchema,
					locale: t.String(),
				}, ["component"]),
				response: {
					200: {
						description: "Send validation code result",
						content: {
							"application/json": {
								schema: throwableSchema(t.Object({
									sent: t.Boolean(),
								}, ["sent"])),
							},
						},
					},
				},
			},
		)
		.post(
			"/component/submitValidationCode",
			async ({ body, identity }) =>
				wrapThrowable(async () => {
					try {
						await identity.confirmComponentValidationCode(body.code);
						return { confirmed: true };
					} catch (_error) {
						return { confirmed: false };
					}
				}),
			{
				summary: "Submit validation code",
				tags: ["Authentication"],
				body: t.Object({
					code: t.String(),
				}, ["code"]),
				response: {
					200: {
						description: "Submit validation code result",
						content: {
							"application/json": {
								schema: throwableSchema(t.Object({
									confirmed: t.Boolean(),
								}, ["confirmed"])),
							},
						},
					},
				},
			},
		);
}
