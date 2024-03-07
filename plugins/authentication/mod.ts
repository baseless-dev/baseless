// deno-lint-ignore-file ban-types
import { jwtVerify } from "npm:jose@5.2.0";
import { t, type TSchema } from "../../lib/typebox.ts";
import {
	AuthenticationSubmitPromptError,
	MissingRefreshTokenError,
	UnauthorizedError,
} from "../../lib/authentication/errors.ts";
import { simplify } from "../../lib/authentication/simplify.ts";
import {
	AuthenticationCeremonyStateSchema,
	AuthenticationSendPromptResultSchema,
	AuthenticationSubmitPromptStateSchema,
	sequence,
} from "../../lib/authentication/types.ts";
import { assertAutoId, isAutoId } from "../../lib/autoid.ts";
import { createLogger } from "../../lib/logger.ts";
import { SESSION_AUTOID_PREFIX } from "../../lib/session/types.ts";
import { slidingWindow } from "../../providers/counter.ts";
import AuthenticationService from "./authentication.ts";
import type { AuthenticationContext, TokenData } from "./context.ts";
import { createTokens } from "./create_tokens.ts";
import { Router } from "../../lib/router/router.ts";
import { RateLimitedError } from "../../lib/errors.ts";
import { AuthenticationConfiguration } from "./configuration.ts";
import type { CounterService } from "../counter/counter.ts";
import type { IdentityService } from "../identity/identity.ts";
import type { SessionService } from "../session/session.ts";

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

export const authentication = (
	builder:
		| AuthenticationConfiguration
		| ((
			configuration: AuthenticationConfiguration,
		) => AuthenticationConfiguration),
) => {
	const logger = createLogger("authentication-plugin");
	const configuration = builder instanceof AuthenticationConfiguration
		? builder.build()
		: builder(new AuthenticationConfiguration()).build();
	const ceremony = simplify(
		sequence(configuration.ceremony, { kind: "done" as const }),
	);

	return new Router<
		{},
		{
			counter: CounterService;
			identity: IdentityService;
			session: SessionService;
		}
	>()
		.derive(async ({ request, session, identity }) => {
			let authenticationToken: TokenData | undefined;
			if (request.headers.has("Authorization")) {
				const authorization = request.headers.get("Authorization") ?? "";
				const [, scheme, accessToken] =
					authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/) ?? [];
				if (scheme === "Bearer") {
					try {
						const { payload } = await jwtVerify(
							accessToken,
							configuration.keys.publicKey,
						);
						if (isAutoId(payload.sub, SESSION_AUTOID_PREFIX)) {
							const sessionData = await session.get(
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

			const context: AuthenticationContext = {
				get remoteAddress() {
					return remoteAddress;
				},
				get authenticationToken() {
					return authenticationToken;
				},
				get authentication() {
					return new AuthenticationService(
						configuration.authenticationProviders,
						ceremony,
						identity,
						configuration.keys,
						configuration.rateLimit,
					);
				},
			};
			return context;
		})
		.post("/sign-out", async ({ session, authenticationToken }) => {
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
		}, {
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
		})
		.post("/refresh-tokens", async ({ body, session, identity }) => {
			try {
				const refreshToken = body.refresh_token;
				if (!refreshToken) {
					return Response.json({ error: MissingRefreshTokenError.name });
				}
				const { payload } = await jwtVerify(
					refreshToken,
					configuration.keys.publicKey,
				);
				const { sub: sessionId, scope } = payload;
				assertAutoId(sessionId, SESSION_AUTOID_PREFIX);
				const sessionData = await session.get(sessionId);
				const id = await identity.get(sessionData.identityId);
				await session.update(
					sessionData,
					configuration.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
				);
				const { access_token, id_token } = await createTokens(
					id,
					sessionData,
					configuration.keys.algo,
					configuration.keys.privateKey,
					configuration.accessTokenTTL ?? 1000 * 60 * 10,
					configuration.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
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
		}, {
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
		})
		.get("/ceremony", async ({ authentication }) => {
			try {
				const data = await authentication.getCeremony();
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
							schema: dataOrError(AuthenticationCeremonyStateSchema),
						},
					},
				},
			},
		})
		.post("/ceremony", async ({ body, authentication }) => {
			try {
				const state = await authentication.decryptAuthenticationState(
					body.state,
				);
				const data = await authentication.getCeremony(state);
				return Response.json({ data });
			} catch (error) {
				return Response.json({ error: error.name });
			}
		}, {
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
							schema: dataOrError(AuthenticationCeremonyStateSchema),
						},
					},
				},
			},
		})
		.post(
			"/submit-prompt",
			async (
				{ body, authentication, remoteAddress, session, identity, counter },
			) => {
				try {
					const state = body.state
						? await authentication.decryptAuthenticationState(body.state)
						: { kind: "authentication" as const, choices: [] };

					const interval = configuration.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"authentication",
						"submitprompt",
						state?.identity ?? remoteAddress,
						slidingWindow(interval).toString(),
					];
					const count = await counter.increment(
						keys,
						1,
						interval,
					);
					if (count > 10) {
						throw new RateLimitedError();
					}

					const result = await authentication.submitPrompt(
						body.component,
						body.prompt,
						state,
					);
					if (result === false) {
						return Response.json({
							error: AuthenticationSubmitPromptError.name,
						});
					} // If prompt returned an identity different from the current state
					else if (typeof result === "object") {
						if (state.identity && result.id !== state.identity) {
							return Response.json({ error: UnauthorizedError.name });
						}
						state.identity = result.id;
					}
					state.choices.push(body.component);
					const nextCeremonyComponent = await authentication.getCeremony(state);
					if (nextCeremonyComponent.done === true) {
						const identityId = state?.identity;
						if (!identityId) {
							return Response.json({ error: UnauthorizedError.name });
						}
						const id = await identity.get(identityId);
						// TODO session expiration
						const sessionData = await session.create(identityId, {});
						const { access_token, id_token, refresh_token } =
							await createTokens(
								id,
								sessionData,
								configuration.keys.algo,
								configuration.keys.privateKey,
								configuration.accessTokenTTL ?? 1000 * 60 * 10,
								configuration.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
							);
						return Response.json({
							data: {
								done: true,
								access_token,
								id_token,
								refresh_token,
							},
						});
					} else {
						return Response.json({
							data: {
								...nextCeremonyComponent,
								state: await authentication.encryptAuthenticationState(state),
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
					state: t.Optional(t.String({ description: "Encrypted state" })),
				}),
				response: {
					200: {
						description: "The sign in prompt result",
						content: {
							"application/json": {
								schema: dataOrError(AuthenticationSubmitPromptStateSchema),
							},
						},
					},
				},
			},
		)
		.post(
			"/send-prompt",
			async ({ body, authentication, remoteAddress, counter }) => {
				try {
					const state = body.state
						? await authentication.decryptAuthenticationState(body.state)
						: undefined;
					const interval = configuration.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"authentication",
						"sendprompt",
						state?.identity ?? remoteAddress,
						slidingWindow(interval).toString(),
					];
					const count = await counter.increment(
						keys,
						1,
						interval,
					);
					if (count > 10) {
						throw new RateLimitedError();
					}

					const result = await authentication.sendPrompt(
						body.component,
						body.locale,
						state,
					);
					return Response.json({
						data: {
							sent: result,
						},
					});
				} catch (error) {
					return Response.json({ error: error.name });
				}
			},
			{
				detail: {
					summary: "Send sign in prompt",
					tags: ["Authentication"],
				},
				body: t.Object({
					component: t.String({ description: "The authentication component" }),
					state: t.Optional(t.String({ description: "Encrypted state" })),
					locale: t.String(),
				}),
				response: {
					200: {
						description: "The send prompt result",
						content: {
							"application/json": {
								schema: dataOrError(AuthenticationSendPromptResultSchema),
							},
						},
					},
				},
			},
		);
};

export default authentication;
