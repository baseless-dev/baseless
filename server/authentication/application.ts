// deno-lint-ignore-file require-await ban-types
import { JWTPayload, jwtVerify, type KeyLike, SignJWT } from "jose";
import { assertID, ID, id, isID } from "@baseless/core/id";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { ApplicationBuilder, ForbiddenError, Permission } from "../application/mod.ts";
import { Static, Type } from "@sinclair/typebox";
import {
	AuthenticationCeremony,
	AuthenticationCeremonyChoiceShallow,
	AuthenticationCeremonyComponent,
	getAuthenticationCeremonyComponentAtPath,
	simplifyAuthenticationCeremony,
} from "./ceremony.ts";
import { NotificationProvider } from "./provider.ts";
import { IdentityComponentProvider } from "./provider.ts";
import { AuthenticationComponent, AuthenticationComponentPrompt } from "./component.ts";
import {
	assertSession,
	AuthenticationCollections,
	AuthenticationContext,
	AuthenticationDecoration,
	AuthenticationDocuments,
	AuthenticationEncryptedState,
	AuthenticationGetCeremonyResponse,
	AuthenticationRpcs,
	AuthenticationState,
	AuthenticationTokens,
	RegistrationCeremonyStep,
	RegistrationEncryptedState,
	RegistrationGetCeremonyResponse,
	RegistrationState,
	Session,
} from "./types.ts";

export interface AuthenticationConfiguration {
	keys: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	ceremony: AuthenticationCeremony;
	identityComponentProviders: Record<string, IdentityComponentProvider>;
	notificationProvider: NotificationProvider;
	ceremonyTTL?: number;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	rateLimitPeriod?: number;
	rateLimitCount?: number;
	allowAnonymous?: boolean;
}

export function configureAuthentication(
	configuration: AuthenticationConfiguration,
): ApplicationBuilder<
	AuthenticationDecoration,
	AuthenticationRpcs,
	[],
	AuthenticationDocuments,
	AuthenticationCollections
> {
	const accessTokenTTL = configuration.accessTokenTTL ?? 1000 * 60 * 10;
	const refreshTokenTTL = configuration.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 2;
	const ceremonyTTL = configuration.ceremonyTTL ?? 1000 * 60 * 5;
	const ceremony = simplifyAuthenticationCeremony(configuration.ceremony);

	return new ApplicationBuilder()
		.decorate(async (context) => {
			let currentSession: (Session & Session) | undefined;
			if (context.request.headers.has("Authorization")) {
				const authorization = context.request.headers.get("Authorization") ?? "";
				const [, scheme, token] = authorization.match(/^([^ ]+) (.+)$/) ?? [];
				if (scheme === "Bearer") {
					try {
						const { payload } = await jwtVerify(token, configuration.keys.publicKey);
						if (isID("sid_", payload.sub)) {
							const key = await context.kv.get(["sessions", payload.sub]);
							assertSession(key.value);
							const { scope, aat } = { scope: [], aat: 0, ...payload };
							currentSession = {
								...key.value,
								scope,
								aat,
							};
						}
					} catch (error) {
						console.error(error);
					}
				} else if (scheme === "Token" && isID("sk_", token)) {
					try {
						const key = await context.kv.get(["session-secret-tokens", token]);
						assertSession(key.value);
						currentSession = key.value;
					} catch (error) {
						console.error(error);
					}
				}
				if (!currentSession) {
					throw new ForbiddenError();
				}
			}
			return {
				currentSession,
				notification: configuration.notificationProvider,
			};
		})
		.collection(["identities"], { schema: Identity })
		.collection(["identities", "{identityId}", "components"], { schema: IdentityComponent })
		.document(["identifications", "{kind}", "{identification}"], { schema: ID("id_") })
		.onDocumentSaving(
			["identities", "{identityId}", "components", "{kind}"],
			async ({ params, atomic, context, document }) => {
				// When new identity component is created with an identification, ensure that it's unique in the identifications collection
				if (document.data.identification) {
					const doc = await context.document.get([
						"identifications",
						document.data.componentId,
						document.data.identification,
					]).catch((_) => null);

					// If not already present, set the identification
					if (!doc) {
						atomic
							.check(
								["identifications", params.kind, document.data.identification],
								null,
							)
							.set(
								["identifications", params.kind, document.data.identification],
								document.data.identityId,
							);
					}
				}
			},
		)
		.onDocumentDeleting(
			["identities", "{identityId}", "components", "{kind}"],
			async ({ atomic, context, params }) => {
				const document = await context.document.get([
					"identities",
					params.identityId,
					"components",
					params.kind,
				]);
				if (document.data.identification) {
					atomic.delete([
						"identifications",
						document.data.componentId,
						document.data.identification,
					]);
				}
			},
		)
		.rpc(["authentication", "signOut"], {
			input: Type.Void(),
			output: Type.Boolean(),
			security: async () => Permission.Execute,
			handler: async ({ context }) => {
				if (context.currentSession?.sessionId) {
					await context.kv.delete(["sessions", context.currentSession.sessionId]);
					return true;
				}
				return false;
			},
		})
		.rpc(["authentication", "refreshAccessToken"], {
			input: Type.String(),
			output: AuthenticationTokens,
			security: async () => Permission.Execute,
			handler: async (
				{ input: refresh_token, context },
			) => {
				const { payload } = await jwtVerify(refresh_token, configuration.keys.publicKey);
				const { sub: sessionId } = payload;
				assertID("sid_", sessionId);
				const kvValue = await context.kv.get(["sessions", sessionId]);
				assertSession(kvValue.value);
				const identity = await context.document.get([
					"identities",
					kvValue.value.identityId,
				]);
				await context.kv.put(
					["sessions", sessionId],
					kvValue.value,
					{
						expiration: refreshTokenTTL ?? accessTokenTTL ?? 1000 * 60 * 2,
					},
				);
				const { access_token, id_token } = await createTokens(
					identity.data,
					kvValue.value,
				);
				return { access_token, id_token, refresh_token };
			},
		})
		.rpc(["authentication", "getCeremony"], {
			input: AuthenticationEncryptedState,
			output: AuthenticationGetCeremonyResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<AuthenticationState>(input);
				const component = await getCurrentAuthenticationCeremonyFromState(
					state.choices ?? [],
				);
				if (component === true) {
					return createSessionAndTokens(context, state);
				}

				const current = await mapCeremonyToComponent(context, component);
				return { ceremony, current, state: input };
			},
		})
		.rpc(["authentication", "submitPrompt"], {
			input: Type.Object({
				id: Type.String(),
				value: Type.Unknown(),
				state: Type.Optional(AuthenticationEncryptedState),
			}),
			output: AuthenticationGetCeremonyResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<AuthenticationState>(input.state);
				let component = await getCurrentAuthenticationCeremonyFromState(
					state.choices ?? [],
				);
				if (component === true) {
					throw new InvalidAuthenticationStateError();
				}
				const currentComponent = component.kind === "choice"
					? component.components.find((c) => c.component === input.id)
					: component;

				if (!currentComponent) {
					throw new InvalidAuthenticationStateError();
				}
				const identityComponentProvider =
					configuration.identityComponentProviders[currentComponent.component];
				if (!identityComponentProvider) {
					throw new UnknownIdentityComponentError();
				}
				const identityComponent = state.identityId
					? await context.document.get([
						"identities",
						state.identityId,
						"components",
						currentComponent.component,
					]).then((doc) => doc.data).catch((_) => undefined)
					: undefined;

				if (identityComponent && identityComponent.confirmed === false) {
					throw new AuthenticationSubmitPromptError();
				}
				const result = await identityComponentProvider.verifySignInPrompt({
					componentId: currentComponent.component,
					context,
					value: input.value,
					identityComponent,
				});
				if (result === false) {
					throw new AuthenticationSubmitPromptError();
				}
				if (isID("id_", result)) {
					state.identityId = result;
				}
				// Advance the ceremony
				state.choices = [...state.choices ?? [], input.id];
				component = await getCurrentAuthenticationCeremonyFromState(state.choices);
				if (component === true) {
					return createSessionAndTokens(context, state);
				}
				const current = await mapCeremonyToComponent(context, component);
				const encryptedState = await encryptState<AuthenticationState>(state);
				return { ceremony, current, state: encryptedState };
			},
		})
		.rpc(["authentication", "sendPrompt"], {
			input: Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: Type.Optional(AuthenticationEncryptedState),
			}),
			output: Type.Boolean(),
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<AuthenticationState>(input.state);
				const component = await getCurrentAuthenticationCeremonyFromState(
					state.choices ?? [],
				);
				if (component === true) {
					throw new InvalidAuthenticationStateError();
				}
				const currentComponent = component.kind === "choice"
					? component.components.find((c) => c.component === input.id)
					: component;

				if (!currentComponent) {
					throw new InvalidAuthenticationStateError();
				}
				const identityComponentProvider =
					configuration.identityComponentProviders[currentComponent.component];
				if (!identityComponentProvider) {
					throw new UnknownIdentityComponentError();
				}
				const identityComponent = state.identityId
					? await context.document.get([
						"identities",
						state.identityId,
						"components",
						currentComponent.component,
					]).then((doc) => doc.data).catch((_) => undefined)
					: undefined;

				if (!identityComponent || identityComponent.confirmed === false) {
					return false;
				}
				const result = await identityComponentProvider.sendSignInPrompt?.({
					componentId: currentComponent.component,
					context,
					locale: input.locale,
					identityComponent,
				}) ?? false;
				return result;
			},
		})
		.rpc(["registration", "getCeremony"], {
			input: RegistrationEncryptedState,
			output: RegistrationGetCeremonyResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const result = await getRegistrationCeremony(input, context);
				if (result === true) {
					throw new InvalidRegistrationStateError();
				}
				return result;
			},
		})
		.rpc(["registration", "submitPrompt"], {
			input: Type.Object({
				id: Type.String(),
				value: Type.Unknown(),
				state: Type.Optional(RegistrationEncryptedState),
			}),
			output: RegistrationGetCeremonyResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<RegistrationState>(input.state);
				const currentComponent = await getRegistrationCeremony(input.state, context);
				if (currentComponent === true) {
					throw new RegistrationSubmitPromptError();
				}
				const pickedComponent: AuthenticationComponentPrompt | undefined =
					currentComponent.current.kind === "choice"
						? currentComponent.current.prompts.find((c) => c.id === input.id)
						: currentComponent.current;

				if (!pickedComponent || pickedComponent.id !== input.id) {
					throw new RegistrationSubmitPromptError();
				}

				const provider = configuration.identityComponentProviders[pickedComponent.id];
				if (!provider) {
					throw new UnknownIdentityComponentError();
				}

				const identityComponent = await provider.buildIdentityComponent({
					componentId: pickedComponent.id,
					context,
					value: input.value,
				});

				const identityId = state.identityId ?? id("id_");
				const newState: RegistrationState = {
					identityId,
					components: [
						...state.components ?? [],
						{
							...identityComponent,
							componentId: pickedComponent.id,
							identityId,
						},
					],
				};
				const newEncryptedState = await encryptState<RegistrationState>(newState);

				const nextComponent = await getRegistrationCeremony(newEncryptedState, context);
				if (nextComponent === true) {
					const identityId = await createIdentity(
						context,
						state.identityId!,
						state.components!,
					);
					return createSessionAndTokens(context, { identityId });
				}
				return nextComponent;
			},
		})
		.rpc(["registration", "sendValidationCode"], {
			input: Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: Type.Optional(RegistrationEncryptedState),
			}),
			output: Type.Boolean(),
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<RegistrationState>(input.state);
				const currentComponent = await getRegistrationCeremony(input.state, context);
				if (currentComponent === true) {
					throw new RegistrationSubmitPromptError();
				}
				const pickedComponent: AuthenticationComponentPrompt | undefined =
					currentComponent.current.kind === "choice"
						? currentComponent.current.prompts.find((c) => c.id === input.id)
						: currentComponent.current;
				if (!pickedComponent || pickedComponent.id !== input.id) {
					throw new RegistrationSubmitPromptError();
				}

				const provider = configuration.identityComponentProviders[pickedComponent.id];
				if (!provider || !provider.sendValidationPrompt) {
					throw new UnknownIdentityComponentError();
				}

				return provider.sendValidationPrompt({
					componentId: pickedComponent.id,
					context,
					identityId: state.identityId!,
					locale: input.locale,
				});
			},
		})
		.rpc(["registration", "submitValidationCode"], {
			input: Type.Object({
				id: Type.String(),
				value: Type.Unknown(),
				state: Type.Optional(RegistrationEncryptedState),
			}),
			output: RegistrationGetCeremonyResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<RegistrationState>(input.state);
				const currentComponent = await getRegistrationCeremony(input.state, context);
				if (currentComponent === true) {
					throw new RegistrationSubmitPromptError();
				}
				const pickedComponent: AuthenticationComponentPrompt | undefined =
					currentComponent.current.kind === "choice"
						? currentComponent.current.prompts.find((c) => c.id === input.id)
						: currentComponent.current;

				if (!pickedComponent || pickedComponent.id !== input.id) {
					throw new RegistrationSubmitPromptError();
				}

				const provider = configuration.identityComponentProviders[pickedComponent.id];
				if (!provider || !provider.verifyValidationPrompt) {
					throw new UnknownIdentityComponentError();
				}

				const identityComponent = (state.components ?? []).find((c) =>
					c.componentId === pickedComponent.id
				);
				if (!identityComponent) {
					throw new RegistrationSubmitPromptError();
				}

				const result = await provider.verifyValidationPrompt({
					componentId: pickedComponent.id,
					context,
					value: input.value,
					identityComponent,
				});

				if (!result) {
					throw new RegistrationSubmitPromptError();
				}

				identityComponent.confirmed = true;

				const newEncryptedState = await encryptState<RegistrationState>(state);

				const nextComponent = await getRegistrationCeremony(newEncryptedState, context);
				if (nextComponent === true) {
					const identityId = await createIdentity(
						context,
						state.identityId!,
						state.components!,
					);
					return createSessionAndTokens(context, { identityId });
				}
				return nextComponent;
			},
		});

	async function createTokens(
		identity: Identity,
		session: Session,
	): Promise<{ access_token: string; id_token: string; refresh_token?: string }> {
		const now = Date.now();
		const access_token = await new SignJWT({ scope: session.scope, aat: session.aat })
			.setSubject(session.sessionId ?? "sk")
			.setIssuedAt()
			.setExpirationTime((now + accessTokenTTL) / 1000 >> 0)
			.setProtectedHeader({ alg: configuration.keys.algo })
			.sign(configuration.keys.privateKey);
		const id_token = await new SignJWT({ data: identity.data })
			.setSubject(session.identityId)
			.setIssuedAt()
			.setProtectedHeader({ alg: configuration.keys.algo })
			.sign(configuration.keys.privateKey);
		const refresh_token = await new SignJWT({ scope: session.scope })
			.setSubject(session.sessionId ?? "sk")
			.setIssuedAt(session.aat)
			.setExpirationTime((now + refreshTokenTTL) / 1000 >> 0)
			.setProtectedHeader({ alg: configuration.keys.algo })
			.sign(configuration.keys.privateKey);
		return { access_token, id_token, refresh_token };
	}

	async function encryptState<T extends {}>(
		state: T,
	): Promise<string> {
		const now = Date.now();
		return new SignJWT(state as unknown as JWTPayload)
			.setProtectedHeader({ alg: configuration.keys.algo })
			.setIssuedAt()
			.setExpirationTime((now + ceremonyTTL) / 1000 >> 0)
			.sign(configuration.keys.privateKey);
	}

	async function decryptState<T extends {}>(
		encryptedState: string | undefined,
	): Promise<Partial<T>> {
		try {
			const { payload } = await jwtVerify<AuthenticationState>(
				encryptedState ?? "",
				configuration.keys.publicKey,
			);
			return payload as T;
		} catch (_) {
			return {} as T;
		}
	}

	async function mapCeremonyToComponent(
		context: AuthenticationContext,
		ceremony: AuthenticationCeremonyComponent | AuthenticationCeremonyChoiceShallow,
	): Promise<AuthenticationComponent> {
		if (ceremony.kind === "component") {
			const identityComponent = configuration.identityComponentProviders[ceremony.component];
			if (!identityComponent) {
				throw new UnknownIdentityComponentError();
			}
			return identityComponent.getSignInPrompt({ componentId: ceremony.component, context });
		} else {
			const component: AuthenticationComponent = {
				kind: "choice",
				prompts: await Promise.all(
					ceremony.components.map(async (component) => {
						const identityComponent =
							configuration.identityComponentProviders[component.component];
						if (!identityComponent) {
							throw new UnknownIdentityComponentError();
						}
						return identityComponent.getSignInPrompt({
							componentId: component.component,
							context,
						});
					}),
				),
			};
			return component;
		}
	}

	async function getCurrentAuthenticationCeremonyFromState(
		choices: string[],
	): Promise<
		Exclude<
			ReturnType<typeof getAuthenticationCeremonyComponentAtPath>,
			undefined
		>
	> {
		const component = getAuthenticationCeremonyComponentAtPath(
			ceremony,
			choices,
		);
		if (component === undefined) {
			throw new InvalidAuthenticationStateError();
		}
		return component;
	}

	async function createSessionAndTokens(
		context: AuthenticationContext,
		state: AuthenticationState,
	): Promise<Static<typeof AuthenticationTokens>> {
		const identity = await context.document.get([
			"identities",
			state.identityId!,
		]);
		const session = {
			identityId: identity.data.identityId,
			sessionId: id("sid_"),
			scope: state.scope ?? [],
			aat: Date.now() / 1000 >> 0,
		};
		const { access_token, id_token, refresh_token } = await createTokens(
			identity.data,
			session,
		);
		await context.kv.put(["sessions", session.sessionId], session, {
			expiration: refreshTokenTTL,
		});
		return { access_token, id_token, refresh_token };
	}

	async function getRegistrationCeremony(
		input: Static<typeof RegistrationEncryptedState>,
		context: AuthenticationContext,
	): Promise<Static<typeof RegistrationCeremonyStep> | true> {
		const state = await decryptState<RegistrationState>(input);
		const choices = state.components?.map((c) => c.componentId) ?? [];
		let validating = false;
		const ceremonyComponent = await getCurrentAuthenticationCeremonyFromState(choices);
		let authenticationComponent: AuthenticationComponent;

		const lastComponent = state.components?.at(-1);
		if (lastComponent && !lastComponent.confirmed) {
			const provider = configuration.identityComponentProviders[lastComponent.componentId];
			if (!provider || !provider.getValidationPrompt) {
				throw new UnknownIdentityComponentError();
			}
			validating = true;
			authenticationComponent = await provider.getValidationPrompt({
				componentId: lastComponent.componentId,
				context,
			});
		} else if (ceremonyComponent === true) {
			return true;
		} else if (ceremonyComponent.kind === "component") {
			const provider = configuration.identityComponentProviders[ceremonyComponent.component];
			if (!provider) {
				throw new UnknownIdentityComponentError();
			}
			authenticationComponent = await provider.getSetupPrompt({
				componentId: ceremonyComponent.component,
				context,
			});
		} else {
			const prompts = await Promise.all(
				ceremonyComponent.components.map(async (component) => {
					const provider = configuration.identityComponentProviders[component.component];
					if (!provider) {
						throw new UnknownIdentityComponentError();
					}
					return provider.getSetupPrompt({
						componentId: component.component,
						context,
					});
				}),
			);
			if (prompts.length === 1) {
				authenticationComponent = prompts.at(0)!;
			} else {
				authenticationComponent = { kind: "choice", prompts: prompts };
			}
		}

		return { ceremony, state: input, current: authenticationComponent, validating };
	}

	async function createIdentity(
		context: AuthenticationContext,
		identityId: Identity["identityId"],
		identityComponents: IdentityComponent[],
	): Promise<ID<"id_">> {
		const atomic = context.document.atomic()
			.set(["identities", identityId], { identityId, data: {} });
		for (const component of identityComponents) {
			atomic.set(
				["identities", identityId, "components", component.componentId],
				component,
			);
		}
		await atomic.commit();
		return identityId;
	}
}

export class InvalidAuthenticationStateError extends Error {}
export class InvalidRegistrationStateError extends Error {}
export class UnknownIdentityComponentError extends Error {}
export class AuthenticationSubmitPromptError extends Error {}
export class RegistrationSubmitPromptError extends Error {}
