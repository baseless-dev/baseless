import { t, type TSchema } from "../../lib/typebox.ts";
import type { KeyLike } from "npm:jose@5.2.0";
import { map } from "../../lib/authentication/map.ts";
import { simplify } from "../../lib/authentication/simplify.ts";
import {
	AuthenticationCeremonyComponent,
	sequence,
} from "../../lib/authentication/types.ts";
import { RateLimitedError } from "../../lib/errors.ts";
import {
	RegistrationCeremonyStateSchema,
	RegistrationSendValidationCodeResultSchema,
	RegistrationSubmitStateSchema,
} from "../../lib/registration/types.ts";
import { Router } from "../../lib/router/router.ts";
import type { AuthenticationProvider } from "../../providers/auth.ts";
import {
	type CounterProvider,
	slidingWindow,
} from "../../providers/counter.ts";
import type { IdentityProvider } from "../../providers/identity.ts";
import type { SessionProvider } from "../../providers/session.ts";
import { createTokens } from "../authentication/create_tokens.ts";
import SessionService from "../authentication/session.ts";
import type { Context } from "./context.ts";
import RegistrationService from "./registration.ts";

export type RegistrationKeys = {
	algo: string;
	privateKey: KeyLike;
	publicKey: KeyLike;
};

export type RateLimitOptions = {
	count: number;
	interval: number;
};

export type RegistrationOptions = {
	counter: CounterProvider;
	identity: IdentityProvider;
	session: SessionProvider;
	keys: RegistrationKeys;
	providers: AuthenticationProvider[];
	ceremony: AuthenticationCeremonyComponent;
	rateLimit?: RateLimitOptions;
	allowAnonymousIdentity?: boolean;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
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

export const registration = (
	options: RegistrationOptions,
) => {
	const setupableCeremony = map(options.ceremony, (component) => {
		if (component.kind === "prompt") {
			const provider = options.providers.find((c) => c.id === component.id);
			const setupPrompt = provider?.setupPrompt();
			return setupPrompt ? component : undefined;
		}
		return component;
	});
	if (!setupableCeremony) {
		throw new Error("Invalid ceremony");
	}
	options.ceremony = simplify(sequence(setupableCeremony, { kind: "done" }));

	return new Router()
		.derive(({ request }) => {
			const remoteAddress = request.headers.get("X-Real-Ip") ?? "";

			const context: Context = {
				get remoteAddress() {
					return remoteAddress;
				},
				get registration() {
					return new RegistrationService(
						options.providers,
						options.ceremony,
						options.identity,
						options.keys,
						options.rateLimit,
					);
				},
				get session() {
					return new SessionService(options.session);
				},
			};

			return context;
		})
		.get("/ceremony", async ({ registration }) => {
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
							schema: dataOrError(RegistrationCeremonyStateSchema),
						},
					},
				},
			},
		})
		.post("/ceremony", async ({ body, registration }) => {
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
							schema: dataOrError(RegistrationCeremonyStateSchema),
						},
					},
				},
			},
		})
		.post(
			"/submit-prompt",
			async ({ body, registration, remoteAddress, session }) => {
				try {
					const state = body.state
						? await registration.decryptRegistrationState(body.state)
						: undefined;

					const interval = options.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"registration",
						"submitprompt",
						remoteAddress,
						slidingWindow(interval).toString(),
					];
					const counter = await options.counter.increment(
						keys,
						1,
						interval,
					);
					if (counter > 10) {
						throw new RateLimitedError();
					}

					const result = await registration.submitPrompt(
						body.component,
						body.prompt,
						state,
					);
					if (result.kind === "identity") {
						// TODO session expiration
						const id = await options.identity.get(result.identity.id);
						const sessionData = await session.create(result.identity.id, {});
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
								schema: dataOrError(RegistrationSubmitStateSchema),
							},
						},
					},
				},
			},
		)
		.post(
			"/send-validation-code",
			async ({ body, registration, remoteAddress }) => {
				try {
					const state = body.state
						? await registration.decryptRegistrationState(body.state)
						: undefined;

					const interval = options.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"registration",
						"sendvalidationcode",
						remoteAddress,
						slidingWindow(interval).toString(),
					];
					const counter = await options.counter.increment(
						keys,
						1,
						interval,
					);
					if (counter > 10) {
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
								schema: dataOrError(RegistrationSendValidationCodeResultSchema),
							},
						},
					},
				},
			},
		)
		.post(
			"/submit-validation-code",
			async ({ body, registration, remoteAddress, session }) => {
				try {
					const state = body.state
						? await registration.decryptRegistrationState(body.state)
						: undefined;

					const interval = options.rateLimit?.interval ?? 60 * 1000;
					const keys = [
						"registration",
						"submitvalidationcode",
						remoteAddress,
						slidingWindow(interval).toString(),
					];
					const counter = await options.counter.increment(
						keys,
						1,
						interval,
					);
					if (counter > 10) {
						throw new RateLimitedError();
					}

					const result = await registration.submitValidationCode(
						body.component,
						body.code,
						state,
					);
					if (result.kind === "identity") {
						// TODO session expiration
						const id = await options.identity.get(result.identity.id);
						const sessionData = await session.create(result.identity.id, {});
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
								schema: dataOrError(RegistrationSubmitStateSchema),
							},
						},
					},
				},
			},
		);
};

export default registration;
