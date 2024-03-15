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
import { slidingWindow } from "../../providers/counter/provider.ts";
import AuthenticationService from "./authentication.ts";
import type { AuthenticationContext, TokenData } from "./context.ts";
import { createTokens } from "./create_tokens.ts";
import { Application } from "../../lib/application/application.ts";
import { RateLimitedError } from "../../lib/errors.ts";
import { AuthenticationConfiguration } from "./configuration.ts";
import RegistrationService from "./registration.ts";
import { map } from "../../lib/authentication/map.ts";
import {
	RegistrationCeremonyStateSchema,
	RegistrationSendValidationCodeResultSchema,
	RegistrationSubmitStateSchema,
} from "../../lib/registration/types.ts";
import type { Identity } from "../../lib/identity/types.ts";
import type { CounterContext } from "../counter/context.ts";
import type { SessionContext } from "../session/context.ts";
import type { IdentityContext } from "../identity/context.ts";

export { AuthenticationConfiguration } from "./configuration.ts";

const dataOrError = <T>($id: string, schema: TSchema): TSchema =>
	t.Union([
		t.Object({
			data: schema,
		}),
		t.Object({
			error: t.String({ description: "Error code" }),
		}, { $id: "AuthenticationErrorObject", description: "Error object" }),
	], {
		$id,
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

	const authenticationCeremony = simplify(
		sequence(configuration.authenticationCeremony, { kind: "done" as const }),
	);
	const setupableCeremony = map(
		configuration.registrationCeremony,
		(component) => {
			if (component.kind === "prompt") {
				const provider = configuration.authenticationProviders.find((c) =>
					c.id === component.id
				);
				const setupPrompt = provider?.setupPrompt();
				return setupPrompt ? component : undefined;
			}
			return component;
		},
	);
	if (!setupableCeremony) {
		throw new Error("Invalid registration ceremony");
	}
	const registrationCeremony = simplify(
		sequence(setupableCeremony, { kind: "done" as const }),
	);

	return new Application()
		.demands<CounterContext>()
		.demands<SessionContext>()
		.demands<IdentityContext>()
		.emits<"authentication:register", [identity: Identity]>()
		.emits<"authentication:sign-in", [identity: Identity]>()
		.emits<"authentication:sign-out", [sessionId: string]>()
		.emits<"authentication:rate-limited", [subject: string]>()
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
						authenticationCeremony,
						identity,
						configuration.keys,
						configuration.rateLimit,
					);
				},
				get registration() {
					return new RegistrationService(
						configuration.authenticationProviders,
						registrationCeremony,
						identity,
						configuration.keys,
						configuration.rateLimit,
					);
				},
			};
			return context;
		})
		.post(
			"/authentication/sign-out",
			async ({ session, authenticationToken, events }) => {
				try {
					if (authenticationToken) {
						const sessionId = authenticationToken.sessionData.id;
						await session.destroy(sessionId).catch((_) => {});
						await events.emit("authentication:sign-out", sessionId);
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
								schema: dataOrError(
									"SignOutResponse",
									t.Object({
										ok: t.Literal(true),
									}),
								),
							},
						},
					},
				},
			},
		)
		.post(
			"/authentication/refresh-tokens",
			async ({ body, session, identity }) => {
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
								schema: dataOrError(
									"RefreshTokensResponse",
									t.Object({
										access_token: t.String(),
										id_token: t.String(),
										refresh_token: t.String(),
									}),
								),
							},
						},
					},
				},
			},
		)
		.get("/authentication/ceremony", async ({ authentication }) => {
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
							schema: dataOrError(
								"AuthenticationCeremonyResponse",
								AuthenticationCeremonyStateSchema,
							),
						},
					},
				},
			},
		})
		.post("/authentication/ceremony", async ({ body, authentication }) => {
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
							schema: dataOrError(
								"AuthenticationCeremonyResponse",
								AuthenticationCeremonyStateSchema,
							),
						},
					},
				},
			},
		})
		.post(
			"/authentication/submit-prompt",
			async (
				{
					body,
					authentication,
					remoteAddress,
					session,
					identity,
					counter,
					events,
				},
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
						await events.emit("authentication:sign-in", id);
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
								schema: dataOrError(
									"AuthenticationSubmitPromptResponse",
									AuthenticationSubmitPromptStateSchema,
								),
							},
						},
					},
				},
			},
		)
		.post(
			"/authentication/send-prompt",
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
								schema: dataOrError(
									"AuthenticationSendPromptResponse",
									AuthenticationSendPromptResultSchema,
								),
							},
						},
					},
				},
			},
		)
		.get("/registration/ceremony", async ({ registration }) => {
			try {
				const data = await registration.getCeremony();
				return Response.json({ data });
			} catch (error) {
				return Response.json({ error: error.name });
			}
		}, {
			detail: {
				summary: "Get the registration ceremony",
				tags: ["Registration"],
			},
			response: {
				200: {
					description: "Registration ceremony",
					content: {
						"application/json": {
							schema: dataOrError(
								"RegistrationCeremonyResponse",
								RegistrationCeremonyStateSchema,
							),
						},
					},
				},
			},
		})
		.post("/registration/ceremony", async ({ body, registration }) => {
			try {
				const state = await registration.decryptRegistrationState(
					body.state,
				);
				const data = await registration.getCeremony(state);
				return Response.json({ data });
			} catch (error) {
				return Response.json({ error: error.name });
			}
		}, {
			detail: {
				summary: "Get the registration ceremony from an encrypted state",
				tags: ["Registration"],
			},
			body: t.Object({
				state: t.String({ description: "Encrypted state" }),
			}),
			response: {
				200: {
					description: "Registration ceremony",
					content: {
						"application/json": {
							schema: dataOrError(
								"RegistrationCeremonyResponse",
								RegistrationCeremonyStateSchema,
							),
						},
					},
				},
			},
		})
		.post(
			"/registration/submit-prompt",
			async (
				{
					body,
					registration,
					remoteAddress,
					session,
					counter,
					identity,
					events,
				},
			) => {
				try {
					const state = body.state
						? await registration.decryptRegistrationState(body.state)
						: undefined;

					const interval = configuration.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"registration",
						"submitprompt",
						remoteAddress,
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

					const result = await registration.submitPrompt(
						body.component,
						body.prompt,
						state,
					);
					if (result.kind === "identity") {
						// TODO session expiration
						const id = await identity.get(result.identity.id);
						const sessionData = await session.create(result.identity.id, {});
						const { access_token, id_token, refresh_token } =
							await createTokens(
								id,
								sessionData,
								configuration.keys.algo,
								configuration.keys.privateKey,
								configuration.accessTokenTTL ?? 1000 * 60 * 10,
								configuration.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
							);
						await events.emit("authentication:register", id);
						await events.emit("authentication:sign-in", id);
						return Response.json({
							data: {
								done: true,
								access_token,
								id_token,
								refresh_token,
							},
						});
					}
					const nextCeremonyComponent = await registration.getCeremony(result);
					return Response.json({
						data: {
							...nextCeremonyComponent,
							state: await registration.encryptRegistrationState(result),
						},
					});
				} catch (error) {
					return Response.json({ error: error.name });
				}
			},
			{
				detail: {
					summary: "Submit registration prompt",
					tags: ["Registration"],
				},
				body: t.Object({
					component: t.String({ description: "The authentication component" }),
					prompt: t.Any(),
					state: t.Optional(t.String({ description: "Encrypted state" })),
				}),
				response: {
					200: {
						description: "The registration prompt result",
						content: {
							"application/json": {
								schema: dataOrError(
									"RegistrationSubmitResponse",
									RegistrationSubmitStateSchema,
								),
							},
						},
					},
				},
			},
		)
		.post(
			"/registration/send-validation-code",
			async ({ body, registration, remoteAddress, counter }) => {
				try {
					const state = body.state
						? await registration.decryptRegistrationState(body.state)
						: undefined;

					const interval = configuration.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"registration",
						"sendvalidationcode",
						remoteAddress,
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

					const result = await registration.sendValidationCode(
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
					summary: "Send registration validation code",
					tags: ["Registration"],
				},
				body: t.Object({
					component: t.String({ description: "The authentication component" }),
					state: t.Optional(t.String({ description: "Encrypted state" })),
					locale: t.String({ description: "The locale" }),
				}),
				response: {
					200: {
						description: "The send validation code result",
						content: {
							"application/json": {
								schema: dataOrError(
									"RegistrationSendValidationCodeResponse",
									RegistrationSendValidationCodeResultSchema,
								),
							},
						},
					},
				},
			},
		)
		.post(
			"/registration/submit-validation-code",
			async (
				{
					body,
					registration,
					remoteAddress,
					session,
					counter,
					identity,
					events,
				},
			) => {
				try {
					const state = body.state
						? await registration.decryptRegistrationState(body.state)
						: undefined;

					const interval = configuration.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"registration",
						"submitvalidationcode",
						remoteAddress,
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

					const result = await registration.submitValidationCode(
						body.component,
						body.code,
						state,
					);
					if (result.kind === "identity") {
						// TODO session expiration
						const id = await identity.get(result.identity.id);
						const sessionData = await session.create(result.identity.id, {});
						const { access_token, id_token, refresh_token } =
							await createTokens(
								id,
								sessionData,
								configuration.keys.algo,
								configuration.keys.privateKey,
								configuration.accessTokenTTL ?? 1000 * 60 * 10,
								configuration.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
							);
						await events.emit("authentication:register", id);
						await events.emit("authentication:sign-in", id);
						return Response.json({
							data: {
								done: true,
								access_token,
								id_token,
								refresh_token,
							},
						});
					}
					const nextCeremonyComponent = await registration.getCeremony(result);
					return Response.json({
						data: {
							...nextCeremonyComponent,
							state: await registration.encryptRegistrationState(result),
						},
					});
				} catch (error) {
					return Response.json({ error: error.name });
				}
			},
			{
				detail: {
					summary: "Submit registration validation code",
					tags: ["Registration"],
				},
				body: t.Object({
					component: t.String({ description: "The authentication component" }),
					code: t.String({ description: "The validation code" }),
					state: t.Optional(t.String({ description: "Encrypted state" })),
				}),
				response: {
					200: {
						description: "The registration prompt result",
						content: {
							"application/json": {
								schema: dataOrError(
									"RegistrationSubmitResponse",
									RegistrationSubmitStateSchema,
								),
							},
						},
					},
				},
			},
		);
};

export default authentication;
