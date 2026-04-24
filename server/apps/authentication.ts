import { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
import { app, INTERNAL_HIDE_ENDPOINT } from "../app.ts";
import * as z from "@baseless/core/schema";
import type { Document } from "@baseless/core/document";
import { EncryptJWT, jwtDecrypt, type KeyLike } from "jose";
import { ID, ksuid } from "@baseless/core/id";
import {
	AuthenticationRefreshTokenError,
	AuthenticationSendPromptError,
	AuthenticationSendValidationCodeError,
	AuthenticationSubmitPromptError,
	AuthenticationSubmitValidationCodeError,
	ForbiddenError,
	InvalidAuthenticationStateError,
	RateLimitedError,
	UnknownIdentityComponentError,
} from "@baseless/core/errors";
import { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { type AuthenticationModificationResult, AuthenticationResponse } from "@baseless/core/authentication-response";
import { AppRegistry, IdentityComponentProvider, ServiceCollection } from "@baseless/server";
import {
	AuthenticationCeremony,
	AuthenticationCeremonyChoiceShallow,
	AuthenticationCeremonyComponent,
	getAuthenticationCeremonyComponentAtPath,
	simplifyAuthenticationCeremony,
} from "@baseless/core/authentication-ceremony";
import { AuthenticationComponent } from "@baseless/core/authentication-component";
import { Response } from "@baseless/core/response";

type AuthenticationFlow = "authentication" | "registration" | "modification";
type AuthenticationModificationPhase =
	| "verify-existing"
	| "verify-existing-validation"
	| "setup-new"
	| "setup-new-validation";
type JsonResponse<TBody> = Response<200, { "content-type": "application/json" }, TBody>;
type AuthenticationStepResultBody = {
	result: {
		step: AuthenticationComponent;
		state: string;
		expireAt: number;
		validating: boolean;
	};
};
type AuthenticationBooleanResultBody = { result: boolean };
type AuthenticationModificationResultBody = { result: AuthenticationModificationResult };

/**
 * Async function or value that resolves the authentication / registration /
 * modification
 * ceremony for the current request context.
 */
export type AuthenticationCeremonyResolver = (
	options: {
		context: AppRegistry["context"];
		flow: AuthenticationFlow;
		componentId?: string;
		identityId?: ID<"id_">;
		service: ServiceCollection;
	},
) => AuthenticationCeremony | Promise<AuthenticationCeremony>;

/**
 * Configuration options for the built-in authentication application.
 * Pass this as `{ auth: options }` in the server's `configuration` object.
 */
export interface AuthOptions {
	accessTokenTTL: number;
	authenticationTTL: number;
	ceremony: AuthenticationCeremony | AuthenticationCeremonyResolver;
	components: Record<string, IdentityComponentProvider>;
	keyAlgo: string;
	keyPublic: KeyLike;
	keyPrivate: KeyLike;
	keySecret: Uint8Array;
	rateLimit?: { limit: number; period: number };
	refreshTokenTTL: number;
}

const defaultRateLimiter = { limit: 5, period: 1000 * 60 * 5 };

const authApp = app()
	.requireConfiguration({
		auth: undefined as never as AuthOptions,
	})
	.collection({
		path: "auth/identity",
		schema: Identity,
	})
	.collection({
		path: "auth/identity/:id/component",
		schema: IdentityComponent,
	})
	.collection({
		path: "auth/identity/:id/channel",
		schema: IdentityChannel,
	})
	.document({
		path: "auth/identity-by-identification/:component/:identification",
		schema: z.id("id_"),
	})
	.onDocumentSetting({
		path: "auth/identity/:id/component/:key",
		handler: async ({ atomic, document, service }) => {
			// If component is confirmed and is identification
			if (document.data.identification && document.data.confirmed) {
				const identification = await service.document
					.get("auth/identity-by-identification/:component/:identification", {
						component: document.data.componentId,
						identification: document.data.identification,
					})
					.catch((_) => null);
				if (!identification) {
					atomic
						.check("auth/identity-by-identification/:component/:identification", {
							component: document.data.componentId,
							identification: document.data.identification,
						}, null)
						.set("auth/identity-by-identification/:component/:identification", {
							component: document.data.componentId,
							identification: document.data.identification,
						}, document.data.identityId as never);
				}
			}
		},
	})
	.onDocumentDeleting({
		path: "auth/identity/:id/component/:key",
		handler: async ({ atomic, params, service }) => {
			const document = await service.document.get("auth/identity/:id/component/:key", {
				id: params.id,
				key: params.key,
			}) as Document<IdentityComponent>;
			if (document.data.identification && document.data.confirmed) {
				atomic.delete("auth/identity-by-identification/:component/:identification", {
					component: document.data.componentId,
					identification: document.data.identification,
				});
			}
		},
	})
	.endpoint({
		path: "auth/sign-out",
		request: z.request({
			method: "POST",
			headers: {
				authorization: z.string(),
			},
		}),
		response: z.jsonResponse({
			result: z.boolean(),
		}),
		handler: async ({ service, request }) => {
			const authorization = request.headers.get("authorization");
			if (authorization) {
				try {
					await service.auth.revoke(authorization);
					return Response.json({ result: true });
				} catch (cause) {
					throw new ForbiddenError(undefined, { cause });
				}
			}
			return Response.json({ result: false });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("auth/sign-out")
	.endpoint({
		path: "auth/refresh-token",
		request: z.jsonRequest({
			token: z.string().meta({ id: "RefreshToken" }),
		}),
		response: z.jsonResponse({
			result: AuthenticationTokens,
		}),
		handler: async ({ request, service }) => {
			const { token } = request.body;
			try {
				const result = await service.auth.refreshSession(token);
				return Response.json({ result });
			} catch (cause) {
				throw new AuthenticationRefreshTokenError(undefined, { cause });
			}
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("auth/refresh-token")
	.endpoint({
		path: "auth/begin",
		request: z.jsonRequest({
			kind: z.union([
				z.literal("authentication"),
				z.literal("registration"),
				z.literal("modification"),
			]),
			componentId: z.optional(z.string()),
			scopes: z.optional(z.array(z.string())),
		}),
		response: z.jsonResponse({
			result: AuthenticationResponse,
		}),
		handler: async ({ auth, configuration, context, request, service }) => {
			const { componentId, kind, scopes } = request.body;
			if (kind === "modification") {
				if (!auth?.identityId) {
					throw new ForbiddenError();
				}
				if (!componentId) {
					throw new InvalidAuthenticationStateError();
				}
				const identityComponent = await getIdentityComponent(service, auth.identityId, componentId);
				const stateObj: AuthenticationState = {
					kind: "modification",
					id: auth.identityId,
					componentId,
					mode: identityComponent ? "replace" : "add",
					phase: identityComponent ? "verify-existing" : "setup-new",
					components: [],
					channels: [],
					scopes: scopes ?? [],
				};
				return createModificationStepResponse({
					configuration,
					context,
					options: configuration.auth,
					service,
					state: stateObj,
				});
			}

			const stateObj: AuthenticationState = kind === "authentication"
				? {
					kind: "authentication",
					path: [],
					scopes: scopes ?? [],
				}
				: {
					kind: "registration",
					id: ksuid("id_"),
					components: [],
					channels: [],
					scopes: scopes ?? [],
				};
			const ceremony = await getCeremonyFromFlow({
				context,
				flow: kind,
				options: configuration.auth,
				service,
			});
			const { path, component } = await getAuthenticationCeremonyComponent({
				ceremony,
				configuration,
				context,
				path: [],
				options: configuration.auth,
				service,
				state: stateObj,
			});
			if (!component || component === true) {
				throw new InvalidAuthenticationStateError();
			}
			if (stateObj.kind === "authentication") {
				stateObj.path = path;
			}
			const step = await mapCeremonyToComponent({
				ceremony: component,
				context,
				configuration,
				options: configuration.auth,
				service,
				state: stateObj,
			});
			const [state, expireAt] = await encryptState({ state: stateObj, options: configuration.auth });
			return Response.json({ result: { step, state, expireAt, validating: false } });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("auth/begin")
	.endpoint({
		path: "auth/submit-prompt",
		request: z.jsonRequest({
			id: z.string(),
			value: z.unknown(),
			state: z.string(),
		}),
		response: z.jsonResponse({
			result: AuthenticationResponse,
		}),
		handler: async ({ configuration, context, request, service }) => {
			const { id, value, state } = request.body;
			const decodedState = await decodeAuthenticationState(state, configuration.auth);
			if (decodedState.kind === "modification") {
				return handleModificationSubmitPrompt({
					configuration,
					context,
					id,
					options: configuration.auth,
					service,
					state: decodedState,
					value,
				});
			}
			const { currentComponent, identityComponentProvider, path, stateObj } = await unrollState({
				configuration,
				context,
				id,
				service,
				state: decodedState,
				options: configuration.auth,
			});
			const rateLimit = configuration.auth.rateLimit ?? defaultRateLimiter;
			if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/submit-prompt/${stateObj.id}` })) {
				throw new RateLimitedError();
			}
			if (stateObj.kind === "authentication") {
				const identityComponent = await service.document
					.get("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component })
					.catch((_) => undefined);
				if (identityComponent && identityComponent.data.confirmed === false) {
					throw new AuthenticationSubmitPromptError();
				}
				const result = await identityComponentProvider.verifySignInPrompt({
					configuration,
					componentId: currentComponent.component,
					context,
					value,
					identityComponent: identityComponent?.data,
					service,
				});
				if (result === false) {
					throw new AuthenticationSubmitPromptError();
				}
				if (result !== true) {
					stateObj.id = result;
				}
				stateObj.path.push(currentComponent.component);
				const ceremony = await getCeremonyFromFlow({
					context,
					flow: "authentication",
					options: configuration.auth,
					service,
				});
				const { path: skipPath, component } = await getAuthenticationCeremonyComponent({
					ceremony,
					configuration,
					context,
					path: stateObj.path,
					options: configuration.auth,
					service,
					state: stateObj,
				});
				if (component === true) {
					const identity = await service.document
						//.get(`auth/identity/${stateObj.id}`);
						.get("auth/identity/:key", { key: stateObj.id! });
					const tokens = await service.auth.createSession(
						identity.data,
						Date.now() / 1000 >> 0,
						stateObj.scopes,
					);
					return Response.json({ result: tokens });
				}
				if (!component) {
					throw new InvalidAuthenticationStateError();
				}
				if (stateObj.kind === "authentication") {
					stateObj.path = skipPath;
				}
				const step = await mapCeremonyToComponent({
					ceremony: component,
					configuration,
					context,
					options: configuration.auth,
					service,
					state: stateObj,
				});
				const [state, expireAt] = await encryptState({
					options: configuration.auth,
					state: stateObj,
				});
				return Response.json({ result: { step, state, expireAt, validating: false } });
			} else {
				const [identityComponent, ...identityComponentsOrChannels] = await identityComponentProvider.setupIdentityComponent({
					componentId: currentComponent.component,
					configuration,
					context,
					service,
					value,
				});
				stateObj.components.push({ ...identityComponent, identityId: stateObj.id, componentId: currentComponent.component });
				if (identityComponent.confirmed) {
					path.push(currentComponent.component);
				}
				for (const identityComponentOrChannel of identityComponentsOrChannels) {
					(identityComponentOrChannel as IdentityComponent | IdentityChannel).identityId = stateObj.id;
					if (z.guard(IdentityComponent, identityComponentOrChannel)) {
						stateObj.components.push(identityComponentOrChannel);
						if (identityComponentOrChannel.confirmed) {
							path.push(currentComponent.component);
						}
					} else if (z.guard(IdentityChannel, identityComponentOrChannel)) {
						stateObj.channels.push(identityComponentOrChannel);
					}
				}
				const ceremony = await getCeremonyFromFlow({
					context,
					flow: "registration",
					options: configuration.auth,
					service,
				});
				const { component } = await getAuthenticationCeremonyComponent({
					ceremony,
					configuration,
					context,
					path,
					options: configuration.auth,
					service,
					state: stateObj,
				});
				if (component === true) {
					const identityId = await createIdentity(service, stateObj.id, stateObj.components, stateObj.channels);
					const tokens = await service.auth.createSession(
						{ id: identityId, data: {} },
						Date.now() / 1000 >> 0,
						stateObj.scopes,
					);
					return Response.json({ result: tokens });
				}
				if (!component) {
					throw new InvalidAuthenticationStateError();
				}
				const step = await mapCeremonyToComponent({
					ceremony: component,
					configuration,
					context,
					options: configuration.auth,
					state: stateObj,
					service,
				});
				const [state, expireAt] = await encryptState({
					options: configuration.auth,
					state: stateObj,
				});
				return Response.json({ result: { step, state, expireAt, validating: !identityComponent.confirmed } });
			}
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("auth/submit-prompt")
	.endpoint({
		path: "auth/send-prompt",
		request: z.jsonRequest({
			id: z.string(),
			locale: z.string(),
			state: z.string(),
		}),
		response: z.jsonResponse({
			result: z.boolean(),
		}),
		handler: async ({ configuration, context, request, service }) => {
			const { id, locale, state } = request.body;
			const decodedState = await decodeAuthenticationState(state, configuration.auth);
			if (decodedState.kind === "modification") {
				return handleModificationSendPrompt({
					configuration,
					context,
					id,
					locale,
					options: configuration.auth,
					service,
					state: decodedState,
				});
			}
			const { currentComponent, identityComponentProvider, stateObj } = await unrollState({
				configuration,
				context,
				id,
				options: configuration.auth,
				service,
				state: decodedState,
			});
			if (!identityComponentProvider.sendSignInPrompt) {
				throw new AuthenticationSendPromptError();
			}

			const identityComponent = stateObj.kind === "authentication"
				? await service.document
					.get("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component })
					.then((d) => d.data as IdentityComponent)
				: stateObj.components.find((c) => c.componentId === currentComponent.component);
			if (!identityComponent) {
				throw new AuthenticationSendPromptError();
			}

			const rateLimit = configuration.auth.rateLimit ?? defaultRateLimiter;
			if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/send-prompt/${stateObj.id}` })) {
				throw new RateLimitedError();
			}

			try {
				const result = await identityComponentProvider.sendSignInPrompt({
					componentId: currentComponent.component,
					configuration,
					context,
					identityComponent,
					locale,
					service,
				});
				return Response.json({ result });
			} catch (cause) {
				throw new AuthenticationSendPromptError(undefined, { cause });
			}
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("auth/send-prompt")
	.endpoint({
		path: "auth/send-validation-code",
		request: z.jsonRequest({
			id: z.string(),
			locale: z.string(),
			state: z.string(),
		}),
		response: z.jsonResponse({
			result: z.boolean(),
		}),
		handler: async ({ configuration, context, request, service }) => {
			const { id, locale, state } = request.body;
			const decodedState = await decodeAuthenticationState(state, configuration.auth);
			if (decodedState.kind === "modification") {
				return handleModificationSendValidationCode({
					configuration,
					context,
					id,
					locale,
					options: configuration.auth,
					service,
					state: decodedState,
				});
			}
			const { currentComponent, identityComponentProvider, stateObj } = await unrollState({
				configuration,
				context,
				id,
				options: configuration.auth,
				service,
				state: decodedState,
			});
			if (!identityComponentProvider.sendValidationPrompt) {
				throw new AuthenticationSendValidationCodeError();
			}

			const identityComponent = stateObj.kind === "authentication"
				? await service.document
					.get("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component })
					.then((d) => d.data)
				: stateObj.components.find((c) => c.componentId === currentComponent.component);
			if (!identityComponent) {
				throw new AuthenticationSendValidationCodeError();
			}

			const rateLimit = configuration.auth.rateLimit ?? defaultRateLimiter;
			if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/send-validation-code/${stateObj.id}` })) {
				throw new RateLimitedError();
			}

			try {
				const result = await identityComponentProvider.sendValidationPrompt({
					componentId: currentComponent.component,
					configuration,
					context,
					identityComponent,
					locale,
					service,
				});
				return Response.json({ result });
			} catch (cause) {
				throw new AuthenticationSendValidationCodeError(undefined, { cause });
			}
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("auth/send-validation-code")
	.endpoint({
		path: "auth/submit-validation-code",
		request: z.jsonRequest({
			id: z.string(),
			code: z.unknown(),
			state: z.string(),
		}),
		response: z.jsonResponse({
			result: AuthenticationResponse,
		}),
		handler: async ({ configuration, context, request, service }) => {
			const { id, code, state } = request.body;
			const decodedState = await decodeAuthenticationState(state, configuration.auth);
			if (decodedState.kind === "modification") {
				return handleModificationSubmitValidationCode({
					code,
					configuration,
					context,
					id,
					options: configuration.auth,
					service,
					state: decodedState,
				});
			}
			const { path, currentComponent, identityComponentProvider, stateObj } = await unrollState({
				configuration,
				context,
				id,
				options: configuration.auth,
				service,
				state: decodedState,
			});

			const rateLimit = configuration.auth.rateLimit ?? defaultRateLimiter;
			if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/submit-validation-code/${stateObj.id}` })) {
				throw new RateLimitedError();
			}

			if (!identityComponentProvider.verifyValidationPrompt) {
				throw new AuthenticationSubmitValidationCodeError();
			}

			const identityComponent = stateObj.kind === "authentication"
				? await service.document
					.get("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component })
					.then((d) => d.data)
				: stateObj.components.find((c) => c.componentId === currentComponent.component);
			if (!identityComponent) {
				throw new AuthenticationSubmitValidationCodeError();
			}

			const result = await identityComponentProvider.verifyValidationPrompt({
				componentId: currentComponent.component,
				configuration,
				context,
				identityComponent,
				service,
				value: code,
			});

			if (!result) {
				throw new AuthenticationSubmitValidationCodeError();
			}

			path.push(currentComponent.component);
			if (stateObj.kind === "authentication") {
				stateObj.path.push(currentComponent.component);
			} else {
				identityComponent.confirmed = true;
			}

			const ceremony = await getCeremonyFromFlow({
				context,
				flow: stateObj.kind,
				options: configuration.auth,
				service,
			});
			const { path: skipPath, component } = await getAuthenticationCeremonyComponent({
				ceremony,
				context,
				configuration,
				path,
				options: configuration.auth,
				service,
				state: stateObj,
			});
			if (component === true) {
				const identity = await service.document
					.get("auth/identity/:key", { key: stateObj.id! });
				const tokens = await service.auth.createSession(
					identity.data,
					Date.now() / 1000 >> 0,
					stateObj.scopes,
				);
				return Response.json({ result: tokens });
			}
			if (!component) {
				throw new InvalidAuthenticationStateError();
			}
			if (stateObj.kind === "authentication") {
				stateObj.path = skipPath;
			}
			const step = await mapCeremonyToComponent({
				ceremony: component,
				configuration,
				context,
				options: configuration.auth,
				state: stateObj,
				service,
			});
			const [newState, expireAt] = await encryptState({
				options: configuration.auth,
				state: stateObj,
			});
			return Response.json({ result: { step, state: newState, expireAt, validating: !identityComponent.confirmed } });
		},
	})
	[INTERNAL_HIDE_ENDPOINT]("auth/submit-validation-code");

export default authApp;

/** The compiled authentication {@link App} returned by `authApp.build()`. */
export type AuthenticationApplication = ReturnType<typeof authApp.build>;

async function unrollState({
	configuration,
	context,
	id,
	service,
	state,
	options,
}: {
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	id: string;
	service: ServiceCollection;
	state: string | AuthenticationState;
	options: AuthOptions;
}): Promise<{
	stateObj: AuthenticationState;
	ceremony: AuthenticationCeremony;
	path: string[];
	currentComponent: AuthenticationCeremonyComponent;
	identityComponentProvider: IdentityComponentProvider;
}> {
	const stateObj = typeof state === "string" ? await decodeAuthenticationState(state, options) : state;
	if (stateObj.kind === "modification") {
		throw new InvalidAuthenticationStateError();
	}
	const ceremony = await getCeremonyFromFlow({
		context,
		flow: stateObj.kind,
		identityId: stateObj.kind === "authentication" ? stateObj.id : undefined,
		options,
		service,
	});
	const path = stateObj.kind === "authentication"
		? stateObj.path
		: stateObj.components.filter((c) => c.confirmed).map((c) => c.componentId);
	// const component = getAuthenticationCeremonyComponentAtPath(ceremony, path);
	const { path: skipPath, component } = await getAuthenticationCeremonyComponent({
		ceremony,
		configuration,
		context,
		path,
		options,
		service,
		state: stateObj,
	});
	if (!component || component === true) {
		throw new InvalidAuthenticationStateError();
	}
	if (stateObj.kind === "authentication") {
		stateObj.path = skipPath;
	}
	const currentComponent = component.kind === "choice" ? component.components.find((c) => c.component === id) : component;
	if (!currentComponent) {
		throw new InvalidAuthenticationStateError();
	}
	const identityComponentProvider = options.components[currentComponent.component];
	if (!identityComponentProvider) {
		throw new UnknownIdentityComponentError();
	}

	return { stateObj, ceremony, path, currentComponent, identityComponentProvider };
}

async function encryptState(
	{ state, options }: { state: AuthenticationState; options: AuthOptions },
): Promise<[encryptedState: string, expireAt: number]> {
	const now = Date.now();
	const expireAt = (now + options.authenticationTTL) / 1000 >> 0;
	const encryptedState = await new EncryptJWT({ state })
		.setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
		.setIssuedAt()
		.setExpirationTime(expireAt)
		.encrypt(options.keySecret);
	return [encryptedState, expireAt] as const;
}

async function decryptState(encryptedState: string | undefined, options: AuthOptions): Promise<AuthenticationState> {
	const { payload } = await jwtDecrypt(
		encryptedState ?? "",
		options.keySecret,
	);
	z.assert(AuthenticationState, payload.state);
	return payload.state;
}

async function createIdentity(
	service: ServiceCollection,
	identityId: Identity["id"],
	components: IdentityComponent[],
	channels: IdentityChannel[],
): Promise<ID<"id_">> {
	const atomic = service.document.atomic()
		.set("auth/identity/:key" as never, { key: identityId } as never, { id: identityId, data: {} } as never);
	for (const component of components) {
		atomic.set(
			"auth/identity/:id/component/:key" as never,
			{ id: identityId, key: component.componentId } as never,
			component as never,
		);
	}
	for (const channel of channels) {
		atomic.set(
			"auth/identity/:id/channel/:key" as never,
			{ id: identityId, key: channel.channelId } as never,
			channel as never,
		);
	}
	await atomic.commit();
	return identityId;
}

async function getCeremonyFromFlow(
	{ componentId, context, flow, identityId, service, options }: {
		componentId?: string;
		context: AppRegistry["context"];
		flow: AuthenticationFlow;
		identityId?: ID<"id_">;
		options: AuthOptions;
		service: ServiceCollection;
	},
): Promise<AuthenticationCeremony> {
	if (typeof options.ceremony === "function") {
		const ceremony = await options.ceremony({ componentId, context, flow, identityId, service });
		return simplifyAuthenticationCeremony(ceremony);
	}
	return simplifyAuthenticationCeremony(options.ceremony);
}

async function getAuthenticationCeremonyComponent(
	{ ceremony, configuration, context, path, service, state, options }: {
		ceremony: AuthenticationCeremony;
		configuration: AppRegistry["configuration"];
		context: AppRegistry["context"];
		path: string[];
		options: AuthOptions;
		service: ServiceCollection;
		state: AuthenticationState;
	},
): Promise<{ path: string[]; component: Exclude<ReturnType<typeof getAuthenticationCeremonyComponentAtPath>, undefined> }> {
	while (true) {
		const component = getAuthenticationCeremonyComponentAtPath(ceremony, path);
		if (component === undefined) {
			throw new InvalidAuthenticationStateError();
		} else if (component === true) {
			return { path, component };
		} else if (state.kind === "registration") {
			return { path, component };
		} else {
			const components = component.kind === "choice" ? component.components : [component];
			const unskippableComponents: AuthenticationCeremonyComponent[] = [];
			for (const component of components) {
				if (component.kind === "component") {
					const provider = options.components[component.component];
					if (!provider) {
						throw new UnknownIdentityComponentError();
					}
					const identityComponent = await service.document
						.get("auth/identity/:id/component/:key" as never, { id: state.id!, key: component.component } as never)
						.then((d) => d.data as IdentityComponent)
						.catch((_) => undefined);
					if (identityComponent && identityComponent.confirmed === false) {
						throw new InvalidAuthenticationStateError();
					}
					const skipSignInPrompt = await provider.skipSignInPrompt?.({
						configuration,
						componentId: component.component,
						context,
						identityComponent,
						service,
					});
					if (skipSignInPrompt) {
						path.push(component.component);
						continue;
					}
				}
				unskippableComponents.push(component);
			}
			if (unskippableComponents.length <= 1) {
				return { path, component: unskippableComponents[0] ?? true };
			} else {
				return { path, component: { kind: "choice", components: unskippableComponents } };
			}
		}
	}
}

async function mapCeremonyToComponent({ ceremony, state, configuration, context, service, options }: {
	ceremony: AuthenticationCeremonyComponent | AuthenticationCeremonyChoiceShallow;
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	options: AuthOptions;
	service: ServiceCollection;
	state: AuthenticationState;
}): Promise<AuthenticationComponent> {
	const ceremonyComponents = ceremony.kind === "choice" ? ceremony.components : [ceremony];
	const prompts = await Promise.all(ceremonyComponents.map(async (ceremonyComponent) => {
		const componentId = ceremonyComponent.component;
		const identityComponentProvider = options.components[componentId];
		const identityComponent: IdentityComponent | undefined = state.kind === "authentication"
			? await service.document
				.get("auth/identity/:id/component/:key" as never, { id: state.id!, key: componentId } as never)
				.then((d) => d.data as IdentityComponent)
				.catch((_) => undefined)
			: state.components.find((c) => c.componentId === componentId);
		if (identityComponent && identityComponent.confirmed === false) {
			if (state.kind === "registration" && identityComponentProvider.getValidationPrompt) {
				return identityComponentProvider.getValidationPrompt({ componentId, configuration, context, service });
			}
			throw new InvalidAuthenticationStateError();
		}
		if (state.kind === "registration") {
			return identityComponentProvider.getSetupPrompt({ componentId, configuration, context, service });
		}
		return identityComponentProvider.getSignInPrompt({ componentId, configuration, context, identityComponent, service });
	}));

	return prompts.length === 1 ? prompts[0] : { kind: "choice", prompts };
}

/**
 * Encrypted opaque state blob exchanged between the client and server during
 * a multi-step authentication, registration, or modification ceremony.
 */
export type AuthenticationState =
	| {
		kind: "authentication";
		id?: ID<"id_">;
		path: string[];
		scopes: string[];
	}
	| {
		kind: "registration";
		id: ID<"id_">;
		components: IdentityComponent[];
		channels: IdentityChannel[];
		scopes: string[];
	}
	| {
		kind: "modification";
		id: ID<"id_">;
		componentId: string;
		mode: "add" | "replace";
		phase: AuthenticationModificationPhase;
		components: IdentityComponent[];
		channels: IdentityChannel[];
		scopes: string[];
	};

/** Zod schema for {@link AuthenticationState}. */
export const AuthenticationState = z.union([
	z.strictObject({
		kind: z.literal("authentication"),
		id: z.optional(z.id("id_")),
		path: z.array(z.string()),
		scopes: z.array(z.string()),
	}),
	z.strictObject({
		kind: z.literal("registration"),
		id: z.id("id_"),
		channels: z.array(IdentityChannel),
		components: z.array(IdentityComponent),
		scopes: z.array(z.string()),
	}),
	z.strictObject({
		kind: z.literal("modification"),
		id: z.id("id_"),
		componentId: z.string(),
		mode: z.union([z.literal("add"), z.literal("replace")]),
		phase: z.union([
			z.literal("verify-existing"),
			z.literal("verify-existing-validation"),
			z.literal("setup-new"),
			z.literal("setup-new-validation"),
		]),
		channels: z.array(IdentityChannel),
		components: z.array(IdentityComponent),
		scopes: z.array(z.string()),
	}),
]);

type AuthenticationModificationState = Extract<AuthenticationState, { kind: "modification" }>;
type ValidationIdentityComponentProvider =
	& IdentityComponentProvider
	& Required<
		Pick<
			IdentityComponentProvider,
			"getValidationPrompt" | "sendValidationPrompt" | "verifyValidationPrompt"
		>
	>;

function isValidationIdentityComponentProvider(
	provider: IdentityComponentProvider,
): provider is ValidationIdentityComponentProvider {
	return !!provider.getValidationPrompt && !!provider.sendValidationPrompt &&
		!!provider.verifyValidationPrompt;
}

async function decodeAuthenticationState(
	encryptedState: string | undefined,
	options: AuthOptions,
): Promise<AuthenticationState> {
	try {
		return await decryptState(encryptedState, options);
	} catch (cause) {
		throw new InvalidAuthenticationStateError(undefined, { cause });
	}
}

async function getIdentityComponent(
	service: ServiceCollection,
	identityId: ID<"id_">,
	componentId: string,
): Promise<IdentityComponent | undefined> {
	return await service.document
		.get("auth/identity/:id/component/:key" as never, { id: identityId, key: componentId } as never)
		.then((document) => document.data as IdentityComponent)
		.catch((_) => undefined);
}

function getModificationIdentityComponentProvider(
	options: AuthOptions,
	componentId: string,
): IdentityComponentProvider {
	const provider = options.components[componentId];
	if (!provider) {
		throw new UnknownIdentityComponentError();
	}
	return provider;
}

function getModificationStagedIdentityComponent(
	state: AuthenticationModificationState,
): IdentityComponent | undefined {
	return state.components.find((component) => component.componentId === state.componentId);
}

async function createModificationStepResponse({
	configuration,
	context,
	options,
	service,
	state,
}: {
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	options: AuthOptions;
	service: ServiceCollection;
	state: AuthenticationModificationState;
}): Promise<JsonResponse<AuthenticationStepResultBody>> {
	const { step, validating } = await mapModificationToComponent({
		configuration,
		context,
		options,
		service,
		state,
	});
	const [encryptedState, expireAt] = await encryptState({ options, state });
	return Response.json({ result: { step, state: encryptedState, expireAt, validating } });
}

async function mapModificationToComponent({
	configuration,
	context,
	options,
	service,
	state,
}: {
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	options: AuthOptions;
	service: ServiceCollection;
	state: AuthenticationModificationState;
}): Promise<{ step: AuthenticationComponent; validating: boolean }> {
	const identityComponentProvider = getModificationIdentityComponentProvider(options, state.componentId);
	const identityComponent = state.phase.startsWith("verify-existing")
		? await getIdentityComponent(service, state.id, state.componentId)
		: getModificationStagedIdentityComponent(state);
	if (!identityComponent && state.phase !== "setup-new") {
		throw new InvalidAuthenticationStateError();
	}

	switch (state.phase) {
		case "verify-existing":
			return {
				step: await identityComponentProvider.getSignInPrompt({
					componentId: state.componentId,
					configuration,
					context,
					identityComponent,
					service,
				}),
				validating: false,
			};
		case "verify-existing-validation":
			if (!identityComponentProvider.getValidationPrompt) {
				throw new InvalidAuthenticationStateError();
			}
			return {
				step: await identityComponentProvider.getValidationPrompt({
					componentId: state.componentId,
					configuration,
					context,
					service,
				}),
				validating: true,
			};
		case "setup-new":
			return {
				step: await identityComponentProvider.getSetupPrompt({
					componentId: state.componentId,
					configuration,
					context,
					service,
				}),
				validating: false,
			};
		case "setup-new-validation":
			if (!identityComponentProvider.getValidationPrompt) {
				throw new InvalidAuthenticationStateError();
			}
			return {
				step: await identityComponentProvider.getValidationPrompt({
					componentId: state.componentId,
					configuration,
					context,
					service,
				}),
				validating: true,
			};
	}
}

async function commitModification(
	service: ServiceCollection,
	state: AuthenticationModificationState,
): Promise<AuthenticationModificationResult> {
	const stagedComponent = getModificationStagedIdentityComponent(state);
	if (!stagedComponent || stagedComponent.confirmed === false) {
		throw new InvalidAuthenticationStateError();
	}
	const previousComponent = await getIdentityComponent(service, state.id, state.componentId);
	const atomic = service.document.atomic();
	if (
		previousComponent?.confirmed && previousComponent.identification &&
		previousComponent.identification !== stagedComponent.identification
	) {
		atomic.delete(
			"auth/identity-by-identification/:component/:identification" as never,
			{
				component: previousComponent.componentId,
				identification: previousComponent.identification,
			} as never,
		);
	}
	for (const component of state.components) {
		atomic.set(
			"auth/identity/:id/component/:key" as never,
			{ id: state.id, key: component.componentId } as never,
			component as never,
		);
	}
	for (const channel of state.channels) {
		atomic.set(
			"auth/identity/:id/channel/:key" as never,
			{ id: state.id, key: channel.channelId } as never,
			channel as never,
		);
	}
	await atomic.commit();
	return { kind: "modification-complete", componentId: state.componentId };
}

async function handleModificationSubmitPrompt({
	configuration,
	context,
	id,
	options,
	service,
	state,
	value,
}: {
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	id: string;
	options: AuthOptions;
	service: ServiceCollection;
	state: AuthenticationModificationState;
	value: unknown;
}): Promise<
	JsonResponse<AuthenticationStepResultBody> | JsonResponse<AuthenticationModificationResultBody>
> {
	if (id !== state.componentId) {
		throw new AuthenticationSubmitPromptError();
	}
	const rateLimit = options.rateLimit ?? defaultRateLimiter;
	if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/submit-prompt/${state.id}` })) {
		throw new RateLimitedError();
	}
	const identityComponentProvider = getModificationIdentityComponentProvider(options, state.componentId);
	if (state.phase === "verify-existing") {
		const identityComponent = await getIdentityComponent(service, state.id, state.componentId);
		if (!identityComponent) {
			throw new AuthenticationSubmitPromptError();
		}
		const result = await identityComponentProvider.verifySignInPrompt({
			componentId: state.componentId,
			configuration,
			context,
			identityComponent,
			service,
			value,
		});
		if (result === false || (result !== true && result !== state.id)) {
			throw new AuthenticationSubmitPromptError();
		}
		state.phase = isValidationIdentityComponentProvider(identityComponentProvider) ? "verify-existing-validation" : "setup-new";
		return createModificationStepResponse({ configuration, context, options, service, state });
	}
	if (state.phase !== "setup-new") {
		throw new AuthenticationSubmitPromptError();
	}
	const [identityComponent, ...identityComponentsOrChannels] = await identityComponentProvider.setupIdentityComponent({
		componentId: state.componentId,
		configuration,
		context,
		service,
		value,
	});
	state.components = [{ ...identityComponent, identityId: state.id, componentId: state.componentId }];
	state.channels = [];
	for (const identityComponentOrChannel of identityComponentsOrChannels) {
		(identityComponentOrChannel as IdentityComponent | IdentityChannel).identityId = state.id;
		if (z.guard(IdentityComponent, identityComponentOrChannel)) {
			state.components.push(identityComponentOrChannel);
		} else if (z.guard(IdentityChannel, identityComponentOrChannel)) {
			state.channels.push(identityComponentOrChannel);
		}
	}
	const stagedComponent = getModificationStagedIdentityComponent(state);
	if (!stagedComponent) {
		throw new InvalidAuthenticationStateError();
	}
	if (stagedComponent.confirmed === false) {
		if (!isValidationIdentityComponentProvider(identityComponentProvider)) {
			throw new InvalidAuthenticationStateError();
		}
		state.phase = "setup-new-validation";
		return createModificationStepResponse({ configuration, context, options, service, state });
	}
	return Response.json({ result: await commitModification(service, state) });
}

async function handleModificationSendPrompt({
	configuration,
	context,
	id,
	locale,
	options,
	service,
	state,
}: {
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	id: string;
	locale: string;
	options: AuthOptions;
	service: ServiceCollection;
	state: AuthenticationModificationState;
}): Promise<JsonResponse<AuthenticationBooleanResultBody>> {
	if (id !== state.componentId || state.phase !== "verify-existing") {
		throw new AuthenticationSendPromptError();
	}
	const identityComponentProvider = getModificationIdentityComponentProvider(options, state.componentId);
	if (!identityComponentProvider.sendSignInPrompt) {
		throw new AuthenticationSendPromptError();
	}
	const identityComponent = await getIdentityComponent(service, state.id, state.componentId);
	if (!identityComponent) {
		throw new AuthenticationSendPromptError();
	}
	const rateLimit = options.rateLimit ?? defaultRateLimiter;
	if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/send-prompt/${state.id}` })) {
		throw new RateLimitedError();
	}
	try {
		const result = await identityComponentProvider.sendSignInPrompt({
			componentId: state.componentId,
			configuration,
			context,
			identityComponent,
			locale,
			service,
		});
		return Response.json({ result });
	} catch (cause) {
		throw new AuthenticationSendPromptError(undefined, { cause });
	}
}

async function handleModificationSendValidationCode({
	configuration,
	context,
	id,
	locale,
	options,
	service,
	state,
}: {
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	id: string;
	locale: string;
	options: AuthOptions;
	service: ServiceCollection;
	state: AuthenticationModificationState;
}): Promise<JsonResponse<AuthenticationBooleanResultBody>> {
	if (id !== state.componentId) {
		throw new AuthenticationSendValidationCodeError();
	}
	const identityComponentProvider = getModificationIdentityComponentProvider(options, state.componentId);
	if (!isValidationIdentityComponentProvider(identityComponentProvider)) {
		throw new AuthenticationSendValidationCodeError();
	}
	const identityComponent = state.phase === "verify-existing-validation"
		? await getIdentityComponent(service, state.id, state.componentId)
		: state.phase === "setup-new-validation"
		? getModificationStagedIdentityComponent(state)
		: undefined;
	if (!identityComponent) {
		throw new AuthenticationSendValidationCodeError();
	}
	const rateLimit = options.rateLimit ?? defaultRateLimiter;
	if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/send-validation-code/${state.id}` })) {
		throw new RateLimitedError();
	}
	try {
		const result = await identityComponentProvider.sendValidationPrompt({
			componentId: state.componentId,
			configuration,
			context,
			identityComponent,
			locale,
			service,
		});
		return Response.json({ result });
	} catch (cause) {
		throw new AuthenticationSendValidationCodeError(undefined, { cause });
	}
}

async function handleModificationSubmitValidationCode({
	code,
	configuration,
	context,
	id,
	options,
	service,
	state,
}: {
	code: unknown;
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	id: string;
	options: AuthOptions;
	service: ServiceCollection;
	state: AuthenticationModificationState;
}): Promise<
	JsonResponse<AuthenticationStepResultBody> | JsonResponse<AuthenticationModificationResultBody>
> {
	if (id !== state.componentId) {
		throw new AuthenticationSubmitValidationCodeError();
	}
	const rateLimit = options.rateLimit ?? defaultRateLimiter;
	if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/submit-validation-code/${state.id}` })) {
		throw new RateLimitedError();
	}
	const identityComponentProvider = getModificationIdentityComponentProvider(options, state.componentId);
	if (!isValidationIdentityComponentProvider(identityComponentProvider)) {
		throw new AuthenticationSubmitValidationCodeError();
	}
	if (state.phase === "verify-existing-validation") {
		const identityComponent = await getIdentityComponent(service, state.id, state.componentId);
		if (!identityComponent) {
			throw new AuthenticationSubmitValidationCodeError();
		}
		const result = await identityComponentProvider.verifyValidationPrompt({
			componentId: state.componentId,
			configuration,
			context,
			identityComponent,
			service,
			value: code,
		});
		if (!result) {
			throw new AuthenticationSubmitValidationCodeError();
		}
		state.phase = "setup-new";
		return createModificationStepResponse({ configuration, context, options, service, state });
	}
	if (state.phase !== "setup-new-validation") {
		throw new AuthenticationSubmitValidationCodeError();
	}
	const identityComponent = getModificationStagedIdentityComponent(state);
	if (!identityComponent) {
		throw new AuthenticationSubmitValidationCodeError();
	}
	const result = await identityComponentProvider.verifyValidationPrompt({
		componentId: state.componentId,
		configuration,
		context,
		identityComponent,
		service,
		value: code,
	});
	if (!result) {
		throw new AuthenticationSubmitValidationCodeError();
	}
	identityComponent.confirmed = true;
	return Response.json({ result: await commitModification(service, state) });
}
