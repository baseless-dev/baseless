import { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { ref } from "@baseless/core/ref";
import { EncryptJWT, jwtDecrypt, jwtVerify, type KeyLike, SignJWT } from "jose";
import { assertID, ID, id, isID } from "@baseless/core/id";
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
import { Session } from "@baseless/core/session";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
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

/**
 * Async function or value that resolves the authentication / registration
 * ceremony for the current request context.
 */
export type AuthenticationCeremonyResolver = (
	options: {
		context: AppRegistry["context"];
		flow: "authentication" | "registration";
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
				const ibiRef = ref("auth/identity-by-identification/:component/:identification", {
					component: document.data.componentId,
					identification: document.data.identification,
				});
				const identification = await service.document
					.get(ibiRef)
					.catch((_) => null);
				if (!identification) {
					atomic
						.check(ibiRef, null)
						.set(ibiRef, document.data.identityId);
				}
			}
		},
	})
	.onDocumentDeleting({
		path: "auth/identity/:id/component/:key",
		handler: async ({ atomic, params, service }) => {
			const document = await service.document.get(ref("auth/identity/:id/component/:key", {
				id: params.id,
				key: params.key,
			}));
			if (document.data.identification && document.data.confirmed) {
				atomic.delete(ref("auth/identity-by-identification/:component/:identification", {
					component: document.data.componentId,
					identification: document.data.identification,
				}));
			}
		},
	})
	.endpoint({
		path: "core/auth/sign-out",
		request: z.request({
			method: "POST",
			headers: {
				authorization: z.string(),
			},
		}),
		response: z.jsonResponse({
			result: z.boolean(),
		}),
		handler: async ({ configuration, service, request }) => {
			const authorization = request.headers.get("authorization");
			if (authorization) {
				try {
					const { payload } = await jwtVerify(authorization.slice("Bearer ".length), configuration.auth.keyPublic);
					const { sub, sid } = payload;
					if (isID("id_", sub) && isID("ses_", sid)) {
						await service.kv.delete(`auth/identity/${sub}/session/${sid}`);
						return Response.json({ result: true });
					}
				} catch (cause) {
					throw new ForbiddenError(undefined, { cause });
				}
			}
			return Response.json({ result: false });
		},
	})
	.endpoint({
		path: "core/auth/refresh-token",
		request: z.jsonRequest({
			token: z.string().meta({ id: "RefreshToken" }),
		}),
		response: z.jsonResponse({
			result: AuthenticationTokens,
		}),
		handler: async ({ configuration, request, service }) => {
			const { token } = request.body;
			try {
				const { payload } = await jwtVerify(token, configuration.auth.keyPublic);
				const { sub, sid } = payload;
				assertID("id_", sub);
				assertID("ses_", sid);
				const session = await service.kv.get(`auth/identity/${sub}/session/${sid}`).then((v) => v.value as Session);
				const identity = await service.document.get(ref("auth/identity/:key", { key: sub }));
				const result = await createTokens({
					identity: identity.data,
					issuedAt: session.issuedAt,
					options: configuration.auth,
					sessionId: sid,
					scope: session.scope,
				});
				return Response.json({ result });
			} catch (cause) {
				throw new AuthenticationRefreshTokenError(undefined, { cause });
			}
		},
	})
	.endpoint({
		path: "core/auth/begin",
		request: z.jsonRequest({
			kind: z.union([z.literal("authentication"), z.literal("registration")]),
			scopes: z.optional(z.array(z.string())),
		}),
		response: z.jsonResponse({
			result: AuthenticationResponse,
		}),
		handler: async ({ configuration, context, request, service }) => {
			const { kind, scopes } = request.body;
			const stateObj: AuthenticationState = kind === "authentication"
				? {
					kind: "authentication",
					path: [],
					scopes: scopes ?? [],
				}
				: {
					kind: "registration",
					id: id("id_"),
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
	.endpoint({
		path: "core/auth/submit-prompt",
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
			const { currentComponent, identityComponentProvider, path, stateObj } = await unrollState({
				configuration,
				context,
				id,
				service,
				state,
				options: configuration.auth,
			});
			const rateLimit = configuration.auth.rateLimit ?? defaultRateLimiter;
			if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/submit-prompt/${stateObj.id}` })) {
				throw new RateLimitedError();
			}
			if (stateObj.kind === "authentication") {
				const identityComponent = await service.document
					.get(ref("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component }))
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
						.get(ref("auth/identity/:key", { key: stateObj.id! }));
					const tokens = await createSessionAndTokens({
						service,
						identity: identity.data,
						scope: stateObj.scopes,
						options: configuration.auth,
					});
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
					const tokens = await createSessionAndTokens({
						identity: { id: identityId, data: {} },
						service,
						options: configuration.auth,
						scope: stateObj.scopes,
					});
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
	.endpoint({
		path: "core/auth/send-prompt",
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
			const { currentComponent, identityComponentProvider, stateObj } = await unrollState({
				configuration,
				context,
				id,
				options: configuration.auth,
				service,
				state,
			});
			if (!identityComponentProvider.sendSignInPrompt) {
				throw new AuthenticationSendPromptError();
			}

			const identityComponent = stateObj.kind === "authentication"
				? await service.document
					.get(ref("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component }))
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
	.endpoint({
		path: "core/auth/send-validation-code",
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
			const { currentComponent, identityComponentProvider, stateObj } = await unrollState({
				configuration,
				context,
				id,
				options: configuration.auth,
				service,
				state,
			});
			if (!identityComponentProvider.sendValidationPrompt) {
				throw new AuthenticationSendValidationCodeError();
			}

			const identityComponent = stateObj.kind === "authentication"
				? await service.document
					.get(ref("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component }))
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
	.endpoint({
		path: "core/auth/submit-validation-code",
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
			const { path, currentComponent, identityComponentProvider, stateObj } = await unrollState({
				configuration,
				context,
				id,
				options: configuration.auth,
				service,
				state,
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
					.get(ref("auth/identity/:id/component/:key", { id: stateObj.id!, key: currentComponent.component }))
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
					.get(ref("auth/identity/:key", { key: stateObj.id! }));
				const tokens = await createSessionAndTokens({
					identity: identity.data,
					options: configuration.auth,
					service,
					scope: stateObj.scopes,
				});
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
	});

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
	state: string;
	options: AuthOptions;
}): Promise<{
	stateObj: AuthenticationState;
	ceremony: AuthenticationCeremony;
	path: string[];
	currentComponent: AuthenticationCeremonyComponent;
	identityComponentProvider: IdentityComponentProvider;
}> {
	let stateObj: AuthenticationState;
	try {
		stateObj = await decryptState(state, options);
	} catch (cause) {
		throw new InvalidAuthenticationStateError(undefined, { cause });
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
		.set(ref("auth/identity/:key", { key: identityId }) as never, { id: identityId, data: {} } as never);
	for (const component of components) {
		atomic.set(
			ref("auth/identity/:id/component/:key", { id: identityId, key: component.componentId }) as never,
			component as never,
		);
	}
	for (const channel of channels) {
		atomic.set(
			ref("auth/identity/:id/channel/:key", { id: identityId, key: channel.channelId }) as never,
			channel as never,
		);
	}
	await atomic.commit();
	return identityId;
}

async function createSessionAndTokens({
	service,
	identity,
	scope,
	options,
}: {
	service: ServiceCollection;
	identity: Identity;
	scope: Session["scope"];
	options: AuthOptions;
}): Promise<AuthenticationTokens> {
	const sessionId = id("ses_");
	const session: Session = {
		identityId: identity.id,
		issuedAt: Date.now() / 1000 >> 0,
		scope,
	};
	const tokens = await createTokens({
		identity,
		issuedAt: session.issuedAt,
		options,
		sessionId,
		scope,
	});
	await service.kv.put(`auth/identity/${identity.id}/session/${sessionId}`, session, {
		expiration: options.refreshTokenTTL ?? options.accessTokenTTL,
	});
	return tokens;
}

async function getCeremonyFromFlow(
	{ context, flow, identityId, service, options }: {
		context: AppRegistry["context"];
		flow: "authentication" | "registration";
		identityId?: ID<"id_">;
		options: AuthOptions;
		service: ServiceCollection;
	},
): Promise<AuthenticationCeremony> {
	if (typeof options.ceremony === "function") {
		const ceremony = await options.ceremony({ context, flow, identityId, service });
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
						.get(ref("auth/identity/:id/component/:key", { id: state.id!, key: component.component }) as never)
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

async function createTokens(
	{
		identity,
		issuedAt,
		options,
		sessionId,
		scope,
	}: {
		identity: Identity;
		issuedAt: number;
		options: AuthOptions;
		sessionId: ID<"ses_">;
		scope: string[];
	},
): Promise<AuthenticationTokens> {
	const now = Date.now();
	const accessToken = await new SignJWT({ scope, aat: issuedAt, sid: sessionId })
		.setSubject(identity.id)
		.setIssuedAt()
		.setExpirationTime((now + options.accessTokenTTL) / 1000 >> 0)
		.setProtectedHeader({ alg: options.keyAlgo })
		.sign(options.keyPrivate);
	const idToken = await new SignJWT({ claims: Object.fromEntries(scope.map((s) => [s, identity.data?.[s]])) })
		.setSubject(identity.id)
		.setIssuedAt()
		.setProtectedHeader({ alg: options.keyAlgo })
		.sign(options.keyPrivate);
	const refreshToken = typeof options.refreshTokenTTL === "number"
		? await new SignJWT({ scope, sid: sessionId })
			.setSubject(identity.id)
			.setIssuedAt(issuedAt)
			.setExpirationTime((now + options.refreshTokenTTL) / 1000 >> 0)
			.setProtectedHeader({ alg: options.keyAlgo })
			.sign(options.keyPrivate)
		: undefined;
	return { accessToken, idToken, refreshToken };
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
				.get(ref("auth/identity/:id/component/:key", { id: state.id!, key: componentId }) as never)
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
 * a multi-step authentication or registration ceremony.
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
]);
