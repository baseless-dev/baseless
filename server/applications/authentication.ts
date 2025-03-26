import { jwtVerify, type KeyLike, SignJWT } from "jose";
import {
	collection,
	document,
	onDocumentDeleting,
	onDocumentSetting,
	onRequest,
	Permission,
	RegisteredContext,
	type TDefinition,
} from "../app.ts";
import { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
import type { Session } from "@baseless/core/session";
import * as Type from "@baseless/core/schema";
import { assertID, type ID, id, isID } from "@baseless/core/id";
import {
	type AuthenticationCeremony,
	type AuthenticationCeremonyChoiceShallow,
	type AuthenticationCeremonyComponent,
	getAuthenticationCeremonyComponentAtPath,
	simplifyAuthenticationCeremony,
} from "@baseless/core/authentication-ceremony";
import { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
import type { ServiceCollection } from "../service.ts";
import type { IdentityComponentProvider } from "../provider.ts";
import type { AuthenticationComponent } from "@baseless/core/authentication-component";
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

export type AuthenticationCeremonyResolver = (
	options: {
		context: RegisteredContext;
		flow: "authentication" | "registration";
		identityId?: ID<"id_">;
		service: ServiceCollection;
	},
) => AuthenticationCeremony | Promise<AuthenticationCeremony>;

export interface AuthenticationOptions {
	algo: string;
	privateKey: KeyLike;
	publicKey: KeyLike;
	ceremony: AuthenticationCeremony | AuthenticationCeremonyResolver;
	components: Record<string, IdentityComponentProvider>;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	authenticationTTL?: number;
	rateLimit?: { limit: number; period: number };
}

export default function createAuthenticationApplication(options: AuthenticationOptions): TDefinition[] {
	const authenticationTTL = options.authenticationTTL ?? 1000 * 60 * 5;
	const accessTokenTTL = options.accessTokenTTL ?? 1000 * 60 * 5;
	const refreshTokenTTL = options.refreshTokenTTL;
	const rateLimit = options.rateLimit ?? { limit: 5, period: 1000 * 60 * 5 };
	return [
		collection("auth/identity", Type.Index(Identity, "id"), Identity),
		collection("auth/identity/:id/component", Type.String(), IdentityComponent),
		collection("auth/identity/:id/channel", Type.String(), IdentityChannel),
		document("auth/identity-by-identification/:component/:identification", Type.Index(Identity, "id")),
		onDocumentSetting("auth/identity/:id/component/:component", async ({ atomic, document, service }) => {
			// If component is confirmed and is identification
			if ("identification" in document.data && document.data.confirmed) {
				const identification = await service.document
					.get(`auth/identity-by-identification/${document.data.componentId}/${document.data.identification}`)
					.catch((_) => null);

				// If not already present, set the identification
				if (!identification) {
					atomic
						.check(`auth/identity-by-identification/${document.data.componentId}/${document.data.identification}`, null)
						.set(`auth/identity-by-identification/${document.data.componentId}/${document.data.identification}`, document.data.identityId);
				}
			}
		}),
		onDocumentDeleting("auth/identity/:id/component/:component", async ({ atomic, params, service }) => {
			const component = await service.document.get(`auth/identity/${params.id}/component/${params.component}`);
			Type.assert(IdentityComponent, component.data);
			if ("identification" in component.data && component.data.confirmed) {
				atomic.delete(`auth/identity-by-identification/${component.data.componentId}/${component.data.identification}`);
			}
		}),
		onRequest("auth/sign-out", Type.Void(), Type.Boolean(), async ({ service, request }) => {
			const authorization = request.headers.get("authorization");
			if (authorization && authorization.startsWith("Bearer ")) {
				try {
					const { payload } = await jwtVerify(authorization.slice("Bearer ".length), options.publicKey);
					const { sub, sid } = payload;
					if (isID("id_", sub) && isID("ses_", sid)) {
						await service.kv.delete(`auth/identity/${sub}/session/${sid}`);
						return true;
					}
				} catch (cause) {
					throw new ForbiddenError(undefined, { cause });
				}
			}
			return false;
		}, () => Permission.Fetch),
		onRequest(
			"auth/refresh-token",
			Type.String({ $id: "RefreshToken" }),
			AuthenticationTokens,
			async ({ input, service }) => {
				try {
					const { payload } = await jwtVerify(input, options.publicKey);
					const { sub, sid } = payload;
					assertID("id_", sub);
					assertID("ses_", sid);
					const session = await service.kv.get(`auth/identity/${sub}/session/${sid}`).then((d) => d.value as Session);

					const identity = await service.document.get(`auth/identity/${sub}`).then((d) => d.data as Identity);

					return await createTokens(
						identity,
						sid,
						session.issuedAt,
						session.scope,
					);
				} catch (cause) {
					throw new AuthenticationRefreshTokenError(undefined, { cause });
				}
			},
			() => Permission.Fetch,
		),
		onRequest(
			"auth/begin",
			Type.Union([
				Type.Object({
					kind: Type.Literal("authentication"),
					scopes: Type.Array(Type.String()),
				}, ["kind", "scopes"]),
				Type.Object({
					kind: Type.Literal("registration"),
					scopes: Type.Array(Type.String()),
				}, ["kind"]),
			]),
			AuthenticationResponse,
			async ({ context, input, service }) => {
				const stateObj: AuthenticationState = input.kind === "authentication"
					? {
						kind: "authentication",
						path: [],
						scopes: input.scopes ?? [],
					}
					: {
						kind: "registration",
						id: id("id_"),
						components: [],
						channels: [],
						scopes: input.scopes ?? [],
					};
				const ceremony = await getCeremonyFromFlow({ context, flow: input.kind, service });
				const { path, component } = await getAuthenticationCeremonyComponent({ ceremony, context, path: [], service, state: stateObj });
				if (!component || component === true) {
					throw new InvalidAuthenticationStateError();
				}
				if (stateObj.kind === "authentication") {
					stateObj.path = path;
				}
				const step = await mapCeremonyToComponent(component, stateObj, context, service);
				const state = await encryptState(stateObj);
				return { step, state, validating: false };
			},
		),
		onRequest(
			"auth/submit-prompt",
			Type.Object({
				id: Type.String(),
				value: Type.Unknown(),
				state: Type.String(),
			}, ["id", "value", "state"]),
			AuthenticationResponse,
			async ({ context, input, service }) => {
				const { currentComponent, identityComponentProvider, path, stateObj } = await unrollState(input, context, service);
				if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/submit-prompt/${stateObj.id}` })) {
					throw new RateLimitedError();
				}
				if (stateObj.kind === "authentication") {
					const identityComponent: IdentityComponent | undefined = await service.document
						.get(`auth/identity/${stateObj.id}/component/${currentComponent.component}`)
						.then((d) => d.data as IdentityComponent)
						.catch((_) => undefined);
					if (identityComponent && identityComponent.confirmed === false) {
						throw new AuthenticationSubmitPromptError();
					}
					const result = await identityComponentProvider.verifySignInPrompt({
						componentId: currentComponent.component,
						context,
						value: input.value,
						identityComponent,
						service,
					});
					if (result === false) {
						throw new AuthenticationSubmitPromptError();
					}
					if (result !== true) {
						stateObj.id = result;
					}
					stateObj.path.push(currentComponent.component);
					const ceremony = await getCeremonyFromFlow({ context, flow: "authentication", service });
					const { path: skipPath, component } = await getAuthenticationCeremonyComponent({
						ceremony,
						context,
						path: stateObj.path,
						service,
						state: stateObj,
					});
					if (component === true) {
						const identity = await service.document.get(`auth/identity/${stateObj.id}`).then((d) => d.data as Identity);
						return createSessionAndTokens(service, identity, stateObj.scopes);
					}
					if (!component) {
						throw new InvalidAuthenticationStateError();
					}
					if (stateObj.kind === "authentication") {
						stateObj.path = skipPath;
					}
					const step = await mapCeremonyToComponent(component, stateObj, context, service);
					const state = await encryptState(stateObj);
					return { step, state, validating: false };
				} else {
					const [identityComponent, ...identityComponentsOrChannels] = await identityComponentProvider.setupIdentityComponent({
						componentId: currentComponent.component,
						context,
						service,
						value: input.value,
					});
					stateObj.components.push({ ...identityComponent, identityId: stateObj.id, componentId: currentComponent.component });
					if (identityComponent.confirmed) {
						path.push(currentComponent.component);
					}
					for (const identityComponentOrChannel of identityComponentsOrChannels) {
						(identityComponentOrChannel as IdentityComponent | IdentityChannel).identityId = stateObj.id;
						if (Type.validate(IdentityComponent, identityComponentOrChannel)) {
							stateObj.components.push(identityComponentOrChannel);
							if (identityComponentOrChannel.confirmed) {
								path.push(currentComponent.component);
							}
						} else if (Type.validate(IdentityChannel, identityComponentOrChannel)) {
							stateObj.channels.push(identityComponentOrChannel);
						}
					}
					const ceremony = await getCeremonyFromFlow({ context, flow: "registration", service });
					const { component } = await getAuthenticationCeremonyComponent({
						ceremony,
						context,
						path,
						service,
						state: stateObj,
					});
					if (component === true) {
						const identityId = await createIdentity(service, stateObj.id, stateObj.components, stateObj.channels);
						return createSessionAndTokens(service, { id: identityId, data: {} }, stateObj.scopes);
					}
					if (!component) {
						throw new InvalidAuthenticationStateError();
					}
					const step = await mapCeremonyToComponent(component, stateObj, context, service);
					const state = await encryptState(stateObj);
					return { step, state, validating: !identityComponent.confirmed };
				}
			},
			() => Permission.Fetch,
		),
		onRequest(
			"auth/send-prompt",
			Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: Type.String(),
			}, ["id", "locale", "state"]),
			Type.Boolean(),
			async ({ context, input, service }) => {
				const { currentComponent, identityComponentProvider, stateObj } = await unrollState(input, context, service);
				if (!identityComponentProvider.sendSignInPrompt) {
					throw new AuthenticationSendPromptError();
				}

				const identityComponent = stateObj.kind === "authentication"
					? await service.document.get(`auth/identity/${stateObj.id}/component/${currentComponent.component}`)
						.then((d) => d.data as IdentityComponent)
					: stateObj.components.find((c) => c.componentId === currentComponent.component);
				if (!identityComponent) {
					throw new AuthenticationSendPromptError();
				}

				if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/send-prompt/${stateObj.id}` })) {
					throw new RateLimitedError();
				}

				try {
					return identityComponentProvider.sendSignInPrompt({
						componentId: currentComponent.component,
						context,
						identityComponent,
						locale: input.locale,
						service,
					});
				} catch (cause) {
					throw new AuthenticationSendPromptError(undefined, { cause });
				}
			},
			() => Permission.Fetch,
		),
		onRequest(
			"auth/send-validation-code",
			Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: Type.String(),
			}, ["id", "locale", "state"]),
			Type.Boolean(),
			async ({ context, input, service }) => {
				const { currentComponent, identityComponentProvider, stateObj } = await unrollState(input, context, service);
				if (!identityComponentProvider.sendValidationPrompt) {
					throw new AuthenticationSendValidationCodeError();
				}

				const identityComponent = stateObj.kind === "authentication"
					? await service.document.get(`auth/identity/${stateObj.id}/component/${currentComponent.component}`).then((d) =>
						d.data as IdentityComponent
					)
					: stateObj.components.find((c) => c.componentId === currentComponent.component);
				if (!identityComponent) {
					throw new AuthenticationSendValidationCodeError();
				}

				if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/send-validation-code/${stateObj.id}` })) {
					throw new RateLimitedError();
				}

				try {
					return identityComponentProvider.sendValidationPrompt({
						componentId: currentComponent.component,
						context,
						identityComponent,
						locale: input.locale,
						service,
					});
				} catch (cause) {
					throw new AuthenticationSendValidationCodeError(undefined, { cause });
				}
			},
			() => Permission.Fetch,
		),
		onRequest(
			"auth/submit-validation-code",
			Type.Object({
				id: Type.String(),
				code: Type.Unknown(),
				state: Type.String(),
			}, ["id", "code", "state"]),
			AuthenticationResponse,
			async ({ context, input, service }) => {
				const { path, currentComponent, identityComponentProvider, stateObj } = await unrollState(input, context, service);

				if (!await service.rateLimiter.limit({ ...rateLimit, key: `auth/submit-validation-code/${stateObj.id}` })) {
					throw new RateLimitedError();
				}

				if (!identityComponentProvider.verifyValidationPrompt) {
					throw new AuthenticationSubmitValidationCodeError();
				}

				const identityComponent = stateObj.kind === "authentication"
					? await service.document
						.get(`auth/identity/${stateObj.id}/component/${currentComponent.component}`)
						.then((d) => d.data as IdentityComponent)
					: stateObj.components.find((c) => c.componentId === currentComponent.component);
				if (!identityComponent) {
					throw new AuthenticationSubmitValidationCodeError();
				}

				const result = await identityComponentProvider.verifyValidationPrompt({
					componentId: currentComponent.component,
					context,
					identityComponent,
					service,
					value: input.code,
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

				const ceremony = await getCeremonyFromFlow({ context, flow: stateObj.kind, service });
				const { path: skipPath, component } = await getAuthenticationCeremonyComponent({
					ceremony,
					context,
					path,
					service,
					state: stateObj,
				});
				if (component === true) {
					const identity = await service.document.get(`auth/identity/${stateObj.id}`).then((d) => d.data as Identity);
					return createSessionAndTokens(service, identity, stateObj.scopes);
				}
				if (!component) {
					throw new InvalidAuthenticationStateError();
				}
				if (stateObj.kind === "authentication") {
					stateObj.path = skipPath;
				}
				const step = await mapCeremonyToComponent(component, stateObj, context, service);
				const state = await encryptState(stateObj);
				return { step, state, validating: !identityComponent.confirmed };
			},
			() => Permission.Fetch,
		),
	];

	async function unrollState(input: { state: string; id: string }, context: RegisteredContext, service: ServiceCollection): Promise<{
		stateObj: AuthenticationState;
		ceremony: AuthenticationCeremony;
		path: string[];
		currentComponent: AuthenticationCeremonyComponent;
		identityComponentProvider: IdentityComponentProvider;
	}> {
		let stateObj: AuthenticationState;
		try {
			stateObj = await decryptState(input.state);
		} catch (cause) {
			throw new InvalidAuthenticationStateError(undefined, { cause });
		}
		const ceremony = await getCeremonyFromFlow({
			context,
			flow: stateObj.kind,
			identityId: stateObj.kind === "authentication" ? stateObj.id : undefined,
			service,
		});
		const path = stateObj.kind === "authentication"
			? stateObj.path
			: stateObj.components.filter((c) => c.confirmed).map((c) => c.componentId);
		// const component = getAuthenticationCeremonyComponentAtPath(ceremony, path);
		const { path: skipPath, component } = await getAuthenticationCeremonyComponent({ ceremony, context, path, service, state: stateObj });
		if (!component || component === true) {
			throw new InvalidAuthenticationStateError();
		}
		if (stateObj.kind === "authentication") {
			stateObj.path = skipPath;
		}
		const currentComponent = component.kind === "choice" ? component.components.find((c) => c.component === input.id) : component;
		if (!currentComponent) {
			throw new InvalidAuthenticationStateError();
		}
		const identityComponentProvider = options.components[currentComponent.component];
		if (!identityComponentProvider) {
			throw new UnknownIdentityComponentError();
		}

		return { stateObj, ceremony, path, currentComponent, identityComponentProvider };
	}

	function encryptState(state: AuthenticationState): Promise<string> {
		const now = Date.now();
		return new SignJWT({ state })
			.setProtectedHeader({ alg: options.algo })
			.setIssuedAt()
			.setExpirationTime((now + authenticationTTL) / 1000 >> 0)
			.sign(options.privateKey);
	}

	async function decryptState(encryptedState: string | undefined): Promise<AuthenticationState> {
		const { payload } = await jwtVerify(
			encryptedState ?? "",
			options.publicKey,
		);
		Type.assert(AuthenticationState, payload.state);
		return payload.state;
	}

	async function createIdentity(
		service: ServiceCollection,
		identityId: Identity["id"],
		components: IdentityComponent[],
		channels: IdentityChannel[],
	): Promise<ID<"id_">> {
		const atomic = service.document.atomic()
			.set(`auth/identity/${identityId}`, { id: identityId, data: {} });
		for (const component of components) {
			atomic.set(
				`auth/identity/${identityId}/component/${component.componentId}`,
				component,
			);
		}
		for (const channel of channels) {
			atomic.set(
				`auth/identity/${identityId}/channel/${channel.channelId}`,
				channel,
			);
		}
		await atomic.commit();
		return identityId;
	}

	async function createSessionAndTokens(
		service: ServiceCollection,
		identity: Identity,
		scope: Session["scope"],
	): Promise<AuthenticationTokens> {
		const sessionId = id("ses_");
		const session: Session = {
			identityId: identity.id,
			issuedAt: Date.now() / 1000 >> 0,
			scope,
		};
		const tokens = await createTokens(
			identity,
			sessionId,
			session.issuedAt,
			scope,
		);
		await service.kv.put(`auth/identity/${identity.id}/session/${sessionId}`, session, {
			expiration: refreshTokenTTL ?? accessTokenTTL,
		});
		return tokens;
	}

	async function getCeremonyFromFlow({ context, flow, identityId, service }: {
		context: RegisteredContext;
		flow: "authentication" | "registration";
		identityId?: ID<"id_">;
		service: ServiceCollection;
	}): Promise<AuthenticationCeremony> {
		if (typeof options.ceremony === "function") {
			const ceremony = await options.ceremony({ context, flow, identityId, service });
			return simplifyAuthenticationCeremony(ceremony);
		}
		return simplifyAuthenticationCeremony(options.ceremony);
	}

	async function getAuthenticationCeremonyComponent(
		{ ceremony, context, path, service, state }: {
			ceremony: AuthenticationCeremony;
			context: RegisteredContext;
			path: string[];
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
							.get(`auth/identity/${state.id}/component/${component.component}`)
							.then((d) => d.data as IdentityComponent)
							.catch((_) => undefined);
						if (identityComponent && identityComponent.confirmed === false) {
							throw new InvalidAuthenticationStateError();
						}
						const skipSignInPrompt = await provider.skipSignInPrompt?.({
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
		identity: Identity,
		sessionId: ID<"ses_">,
		issuedAt: number,
		scope: string[],
	): Promise<AuthenticationTokens> {
		const now = Date.now();
		const accessToken = await new SignJWT({ scope: scope, aat: issuedAt, sid: sessionId })
			.setSubject(identity.id)
			.setIssuedAt()
			.setExpirationTime((now + accessTokenTTL) / 1000 >> 0)
			.setProtectedHeader({ alg: options.algo })
			.sign(options.privateKey);
		const idToken = await new SignJWT({ claims: Object.fromEntries(scope.map((s) => [s, identity.data?.[s]])) })
			.setSubject(identity.id)
			.setIssuedAt()
			.setProtectedHeader({ alg: options.algo })
			.sign(options.privateKey);
		const refreshToken = typeof options.refreshTokenTTL === "number"
			? await new SignJWT({ scope: scope, sid: sessionId })
				.setSubject(identity.id)
				.setIssuedAt(issuedAt)
				.setExpirationTime((now + options.refreshTokenTTL) / 1000 >> 0)
				.setProtectedHeader({ alg: options.algo })
				.sign(options.privateKey)
			: undefined;
		return { accessToken, idToken, refreshToken };
	}

	async function mapCeremonyToComponent(
		ceremony: AuthenticationCeremonyComponent | AuthenticationCeremonyChoiceShallow,
		state: AuthenticationState,
		context: RegisteredContext,
		service: ServiceCollection,
	): Promise<AuthenticationComponent> {
		const ceremonyComponents = ceremony.kind === "choice" ? ceremony.components : [ceremony];
		const prompts = await Promise.all(ceremonyComponents.map(async (ceremonyComponent) => {
			const componentId = ceremonyComponent.component;
			const identityComponentProvider = options.components[componentId];
			const identityComponent: IdentityComponent | undefined = state.kind === "authentication"
				? await service.document
					.get(`auth/identity/${state.id}/component/${componentId}`)
					.then((d) => d.data as IdentityComponent)
					.catch((_) => undefined)
				: state.components.find((c) => c.componentId === componentId);
			if (identityComponent && identityComponent.confirmed === false) {
				if (state.kind === "registration" && identityComponentProvider.getValidationPrompt) {
					return identityComponentProvider.getValidationPrompt({ componentId, context, service });
				}
				throw new InvalidAuthenticationStateError();
			}
			if (state.kind === "registration") {
				return identityComponentProvider.getSetupPrompt({ componentId, context, service });
			}
			return identityComponentProvider.getSignInPrompt({ componentId, context, identityComponent, service });
		}));

		return prompts.length === 1 ? prompts[0] : { kind: "choice", prompts };
	}
}

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

export const AuthenticationState: Type.TUnion<[
	Type.TObject<{
		kind: Type.TLiteral<"authentication">;
		id: Type.TID<"id_">;
		path: Type.TArray<Type.TString>;
		scopes: Type.TArray<Type.TString>;
	}, ["kind", "path", "scopes"]>,
	Type.TObject<{
		kind: Type.TLiteral<"registration">;
		id: Type.TID<"id_">;
		channels: Type.TArray<typeof IdentityChannel>;
		components: Type.TArray<typeof IdentityComponent>;
		scopes: Type.TArray<Type.TString>;
	}, ["kind", "id", "channels", "components", "scopes"]>,
]> = Type.Union([
	Type.Object({
		kind: Type.Literal("authentication"),
		id: Type.ID("id_"),
		path: Type.Array(Type.String()),
		scopes: Type.Array(Type.String()),
	}, ["kind", "path", "scopes"]),
	Type.Object({
		kind: Type.Literal("registration"),
		id: Type.ID("id_"),
		channels: Type.Array(IdentityChannel),
		components: Type.Array(IdentityComponent),
		scopes: Type.Array(Type.String()),
	}, ["kind", "id", "channels", "components", "scopes"]),
]);
