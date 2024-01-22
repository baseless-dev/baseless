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
import { UnauthorizedError } from "../../common/auth/errors.ts";
import { createTokens } from "./create_tokens.ts";
export * as t from "../../common/schema/types.ts";

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

// deno-lint-ignore explicit-function-return-type
export default function authPlugin(
	options: AuthenticationOptions,
) {
	const logger = createLogger("auth-plugin");
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
		.post("/signout", async ({ session, authenticationToken }) => {
			if (authenticationToken) {
				const sessionId = authenticationToken.sessionData.id;
				await session.destroy(sessionId).catch((_) => {});
				return Response.json({});
			}
			throw new UnauthorizedError();
		}, {
			summary: "Sign out current session",
			tags: ["Authentication"],
		})
		.post("/refresh", async ({ request, session, identity }) => {
			const refreshToken = request.headers.get("X-Refresh-Token");
			if (!refreshToken) {
				return new Response(null, { status: 400 });
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
				access_token,
				id_token,
				refresh_token: refreshToken,
			});
		}, {
			summary: "Get access token from refresh token",
			tags: ["Authentication"],
		})
		.get("/ceremony", async ({ auth }) => {
			return Response.json(await auth.getAuthenticationCeremony());
		}, {
			summary: "Get the authentication ceremony",
			tags: ["Authentication"],
		})
		.post("/ceremony", async ({ body, auth }) => {
			const state = await decryptEncryptedAuthenticationCeremonyState(
				body.state,
				options.keys.publicKey,
			);
			return Response.json(await auth.getAuthenticationCeremony(state));
		}, {
			summary: "Get the authentication ceremony from an encrypted state",
			tags: ["Authentication"],
			body: t.Object({
				state: t.Referenceable(
					"AuthenticationEncryptedState",
					t.Describe("An authentication encrypted state", t.String()),
				),
			}, ["state"]),
		});
}
