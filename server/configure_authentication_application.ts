// deno-lint-ignore-file require-await ban-types
import { JWTPayload, jwtVerify, type KeyLike, SignJWT } from "jose";
import { assertID, ID, id, isID } from "@baseless/core/id";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { Static, Type } from "@sinclair/typebox";
import { Permission } from "./types.ts";
import {
	AuthenticationCeremony,
	AuthenticationCeremonyChoiceShallow,
	AuthenticationCeremonyComponent,
	getAuthenticationCeremonyComponentAtPath,
	simplifyAuthenticationCeremony,
} from "@baseless/core/authentication-ceremony";
import { AuthenticationComponent, AuthenticationComponentPrompt } from "@baseless/core/authentication-component";
import {
	AuthenticationCollections,
	AuthenticationConfiguration,
	AuthenticationContext,
	AuthenticationDecoration,
	AuthenticationDocuments,
	AuthenticationRpcs,
	AuthenticationState,
	RegistrationState,
} from "./types.ts";
import { ApplicationBuilder } from "./application_builder.ts";
import { assertSession, type Session } from "@baseless/core/session";
import { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { AuthenticationStep } from "@baseless/core/authentication-step";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
import { ForbiddenError } from "./application.ts";
import { RegistrationResponse } from "@baseless/core/registration-response";
import { RegistrationStep } from "@baseless/core/registration-step";

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

	return new ApplicationBuilder()
		.decorate(async (context) => {
			let currentSession: Session | undefined;
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
					} catch (error) {}
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
					// TODO AuthorizationError?
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
		.rpc(["authentication", "begin"], {
			input: Type.Array(Type.String()),
			output: AuthenticationStep,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const ceremony = await getCeremonyFromFlow({
					context,
					flow: "authentication",
					identityId: undefined,
				});
				const { choices, component } = await getCurrentAuthenticationCeremony({
					ceremony,
					choices: [],
					context,
					flow: "authentication",
					identityId: undefined,
				});
				if (component === true) {
					throw new InvalidAuthenticationStateError();
				}

				const current = await mapCeremonyToComponent(context, undefined, component);
				const state = await encryptState<AuthenticationState>({
					choices,
					identityId: undefined,
					scope: input,
				});
				return { ceremony, current, state };
			},
		})
		.rpc(["authentication", "submitPrompt"], {
			input: Type.Object({
				id: Type.String(),
				value: Type.Unknown(),
				state: Type.String(),
			}),
			output: AuthenticationResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<AuthenticationState>(input.state);
				const ceremony = await getCeremonyFromFlow({
					context,
					flow: "authentication",
					identityId: state.identityId,
				});
				const { choices, component } = await getCurrentAuthenticationCeremony({
					ceremony,
					choices: state.choices,
					context,
					flow: "authentication",
					identityId: undefined,
				});
				if (component === true) {
					throw new InvalidAuthenticationStateError();
				}
				const currentComponent = component.kind === "choice"
					? component.components.find((c) => c.component === input.id)
					: component;

				if (!currentComponent) {
					throw new InvalidAuthenticationStateError();
				}
				const identityComponentProvider = configuration.identityComponentProviders[currentComponent.component];
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
				const { choices: nextChoices, component: nextComponent } = await getCurrentAuthenticationCeremony({
					ceremony,
					choices: [...choices, currentComponent.component],
					context,
					flow: "authentication",
					identityId: state.identityId,
				});
				if (nextComponent === true) {
					return createSessionAndTokens(context, state);
				}
				const current = await mapCeremonyToComponent(context, state.identityId, nextComponent);
				const nextState = await encryptState<AuthenticationState>({
					...state,
					choices: nextChoices,
				});
				return { ceremony, current, state: nextState };
			},
		})
		.rpc(["authentication", "sendPrompt"], {
			input: Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: Type.String(),
			}),
			output: Type.Boolean(),
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<AuthenticationState>(input.state);
				const ceremony = await getCeremonyFromFlow({
					context,
					flow: "authentication",
					identityId: state.identityId,
				});
				const { component } = await getCurrentAuthenticationCeremony({
					ceremony,
					choices: state.choices,
					context,
					flow: "authentication",
					identityId: undefined,
				});
				if (component === true) {
					throw new InvalidAuthenticationStateError();
				}
				const currentComponent = component.kind === "choice"
					? component.components.find((c) => c.component === input.id)
					: component;

				if (!currentComponent) {
					throw new InvalidAuthenticationStateError();
				}
				const identityComponentProvider = configuration.identityComponentProviders[currentComponent.component];
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
				const result = await identityComponentProvider.sendSignInPrompt?.({
					componentId: currentComponent.component,
					context,
					locale: input.locale,
					identityComponent,
				}) ?? false;
				return result;
			},
		})
		.rpc(["registration", "begin"], {
			input: Type.Void(),
			output: RegistrationResponse,
			security: async () => Permission.Execute,
			handler: async ({ context }) => {
				const state = await encryptState<RegistrationState>({
					components: [],
					identityId: undefined,
				});
				const result = await getRegistrationCeremony(state, context);
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
				state: Type.String(),
			}),
			output: RegistrationResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<RegistrationState>(input.state);
				const currentComponent = await getRegistrationCeremony(input.state, context);
				if (currentComponent === true) {
					throw new RegistrationSubmitPromptError();
				}
				const pickedComponent: AuthenticationComponentPrompt | undefined = currentComponent.current.kind === "choice"
					? currentComponent.current.prompts.find((c) => c.id === input.id)
					: currentComponent.current;

				if (!pickedComponent || pickedComponent.id !== input.id) {
					throw new RegistrationSubmitPromptError();
				}

				const provider = configuration.identityComponentProviders[pickedComponent.id];
				if (!provider) {
					throw new UnknownIdentityComponentError();
				}

				const identityComponent = await provider.setupIdentityComponent({
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
						newState.identityId!,
						newState.components!,
					);
					return createSessionAndTokens(context, { choices: [], identityId, scope: [] });
				}
				return nextComponent;
			},
		})
		.rpc(["registration", "sendValidationCode"], {
			input: Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: Type.String(),
			}),
			output: Type.Boolean(),
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<RegistrationState>(input.state);
				const currentComponent = await getRegistrationCeremony(input.state, context);
				if (currentComponent === true) {
					throw new RegistrationSubmitPromptError();
				}
				const pickedComponent: AuthenticationComponentPrompt | undefined = currentComponent.current.kind === "choice"
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
				state: Type.String(),
			}),
			output: RegistrationResponse,
			security: async () => Permission.Execute,
			handler: async ({ input, context }) => {
				const state = await decryptState<RegistrationState>(input.state);
				const currentComponent = await getRegistrationCeremony(input.state, context);
				if (currentComponent === true) {
					throw new RegistrationSubmitPromptError();
				}
				const pickedComponent: AuthenticationComponentPrompt | undefined = currentComponent.current.kind === "choice"
					? currentComponent.current.prompts.find((c) => c.id === input.id)
					: currentComponent.current;

				if (!pickedComponent || pickedComponent.id !== input.id) {
					throw new RegistrationSubmitPromptError();
				}

				const provider = configuration.identityComponentProviders[pickedComponent.id];
				if (!provider || !provider.verifyValidationPrompt) {
					throw new UnknownIdentityComponentError();
				}

				const identityComponent = (state.components ?? []).find((c) => c.componentId === pickedComponent.id);
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
					const identityId = await createIdentity(context, state.identityId!, state.components!);
					return createSessionAndTokens(context, { scope: [], identityId, choices: [] });
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
	): Promise<T> {
		const { payload } = await jwtVerify(
			encryptedState ?? "",
			configuration.keys.publicKey,
		);
		return payload as T;
	}

	async function mapCeremonyToComponent(
		context: AuthenticationContext,
		identityId: ID<"id_"> | undefined,
		ceremony: AuthenticationCeremonyComponent | AuthenticationCeremonyChoiceShallow,
	): Promise<AuthenticationComponent> {
		if (ceremony.kind === "component") {
			const identityComponentProvider = configuration.identityComponentProviders[ceremony.component];
			if (!identityComponentProvider) {
				throw new UnknownIdentityComponentError();
			}
			const identityComponent = identityId
				? await context.document.get(["identities", identityId, "components", ceremony.component])
					.then((doc) => doc.data).catch((_) => undefined)
				: undefined;
			if (identityComponent && identityComponent.confirmed === false) {
				throw new AuthenticationSubmitPromptError();
			}
			return identityComponentProvider.getSignInPrompt({ componentId: ceremony.component, context, identityComponent });
		} else {
			const component: AuthenticationComponent = {
				kind: "choice",
				prompts: await Promise.all(
					ceremony.components.map(async (component) => {
						const identityComponentProvider = configuration.identityComponentProviders[component.component];
						if (!identityComponentProvider) {
							throw new UnknownIdentityComponentError();
						}
						const identityComponent = identityId
							? await context.document.get(["identities", identityId, "components", component.component])
								.then((doc) => doc.data).catch((_) => undefined)
							: undefined;
						if (!identityComponent || identityComponent.confirmed === false) {
							throw new AuthenticationSubmitPromptError();
						}
						return identityComponentProvider.getSignInPrompt({ componentId: component.component, context, identityComponent });
					}),
				),
			};
			return component;
		}
	}

	async function getCeremonyFromFlow({ context, flow, identityId }: {
		context: AuthenticationContext;
		flow: "authentication" | "registration";
		identityId?: ID<"id_">;
	}): Promise<AuthenticationCeremony> {
		if (typeof configuration.ceremony === "function") {
			const ceremony = await configuration.ceremony({ context, flow, identityId });
			return simplifyAuthenticationCeremony(ceremony);
		}
		return simplifyAuthenticationCeremony(configuration.ceremony);
	}

	async function getCurrentAuthenticationCeremony(
		{ ceremony, choices, context, flow, identityId }: {
			ceremony: AuthenticationCeremony;
			choices: string[];
			context: AuthenticationContext;
			flow: "authentication" | "registration";
			identityId?: ID<"id_">;
		},
	): Promise<{
		choices: string[];
		component: Exclude<
			ReturnType<typeof getAuthenticationCeremonyComponentAtPath>,
			undefined
		>;
	}> {
		while (true) {
			const component = getAuthenticationCeremonyComponentAtPath(ceremony, choices);
			if (component === undefined) {
				throw new InvalidAuthenticationStateError();
			} else if (component === true) {
				return { choices, component };
			} else if (flow === "authentication") {
				const components = component.kind === "component" ? [component] : component.components;
				const unskippableComponents = [];
				for (const component of components) {
					if (component.kind === "component") {
						const provider = configuration.identityComponentProviders[component.component];
						if (!provider) {
							throw new UnknownIdentityComponentError();
						}
						const identityComponent = identityId
							? await context.document.get(["identities", identityId, "components", component.component])
								.then((doc) => doc.data).catch((_) => undefined)
							: undefined;
						if (identityComponent && identityComponent.confirmed === false) {
							throw new AuthenticationSubmitPromptError();
						}
						if (await provider.skipSignInPrompt?.({ componentId: component.component, context, identityComponent }) === true) {
							choices.push(component.component);
							continue;
						}
					}
					unskippableComponents.push(component);
				}
				if (unskippableComponents.length <= 1) {
					return { choices, component: unskippableComponents[0] ?? true };
				} else {
					return {
						choices,
						component: { kind: "choice", components: unskippableComponents },
					};
				}
			}
		}
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
		input: string,
		context: AuthenticationContext,
	): Promise<RegistrationStep | true> {
		const state = await decryptState<RegistrationState>(input).catch((_) => ({
			components: [],
			identityId: undefined,
		}));
		const choices = state.components?.map((c) => c.componentId) ?? [];
		let validating = false;
		const ceremony = await getCeremonyFromFlow({
			context,
			flow: "registration",
			identityId: state.identityId,
		});
		const ceremonyComponent = await getAuthenticationCeremonyComponentAtPath(
			ceremony,
			choices,
		);
		if (ceremonyComponent === undefined) {
			throw new InvalidAuthenticationStateError();
		}
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
