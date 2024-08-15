// deno-lint-ignore-file require-await
import { JWTPayload, jwtVerify, type KeyLike, SignJWT } from "jose";
import { assertID, ID, id, isID, TID } from "@baseless/core/id";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import {
	ApplicationBuilder,
	CollectionDefinitionWithoutSecurity,
	Context,
	DocumentDefinitionWithoutSecurity,
	ForbiddenError,
	RpcDefinition,
} from "../application/mod.ts";
import { Static, TBoolean, TObject, TString, TUnknown, TVoid, Type } from "@sinclair/typebox";
import {
	AuthenticationCeremony,
	AuthenticationCeremonyChoiceShallow,
	AuthenticationCeremonyComponent,
	getAuthenticationCeremonyComponentAtPath,
	simplifyAuthenticationCeremony,
} from "./ceremony.ts";
import { Session, SessionProvider } from "../provider/session.ts";
import { NotificationProvider } from "./provider.ts";
import { IdentityComponentProvider } from "./provider.ts";
import { AuthenticationComponent } from "./component.ts";

export interface AuthenticationConfiguration {
	keys: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	ceremony: AuthenticationCeremony;
	identityComponentProviders: IdentityComponentProvider[];
	sessionProvider: SessionProvider;
	notificationProvider: NotificationProvider;
	ceremonyTTL?: number;
	accessTokenTTL?: number;
	refreshTokenTTL?: number;
	rateLimitPeriod?: number;
	rateLimitCount?: number;
	allowAnonymous?: boolean;
}

export interface SessionMeta {
	scope: string[];
	aat: number;
}

export interface AuthenticationDecoration {
	session: SessionProvider;
	notification: NotificationProvider;
	currentSession: (Session & SessionMeta) | undefined;
}

export type AuthenticationRpcs = [
	RpcDefinition<["authentication", "signOut"], TVoid, TBoolean>,
	RpcDefinition<
		["authentication", "refreshAccessToken"],
		TObject<{ refresh_token: TString }>,
		typeof AuthenticationTokens
	>,
	RpcDefinition<
		["authentication", "getCeremony"],
		typeof AuthenticationEncryptedState,
		typeof AuthenticationGetCeremonyResponse
	>,
	RpcDefinition<
		["authentication", "submitPrompt"],
		TObject<{ id: TString; value: TUnknown; state: typeof AuthenticationEncryptedState }>,
		typeof AuthenticationGetCeremonyResponse
	>,
	RpcDefinition<
		["authentication", "sendPrompt"],
		TObject<{ id: TString; locale: TString; state: typeof AuthenticationEncryptedState }>,
		TBoolean
	>,
];

export type AuthenticationDocuments = [
	DocumentDefinitionWithoutSecurity<
		["identities", string],
		typeof Identity
	>,
	DocumentDefinitionWithoutSecurity<
		["identities", string, "components", string],
		typeof IdentityComponent
	>,
	DocumentDefinitionWithoutSecurity<
		["identifications", "{kind}", "{identification}"],
		TID<"id_">
	>,
];

export type AuthenticationCollections = [
	CollectionDefinitionWithoutSecurity<["identities"], typeof Identity>,
	CollectionDefinitionWithoutSecurity<
		["identities", "{identityId}", "components"],
		typeof IdentityComponent
	>,
];

export type AuthenticationContext = Context<
	AuthenticationDecoration,
	AuthenticationDocuments,
	AuthenticationCollections
>;

interface AuthenticationState {
	identityId?: ID<"id_">;
	choices?: string[];
}

export const AuthenticationEncryptedState = Type.Union([Type.String(), Type.Undefined()], {
	$id: "AuthenticationState",
});

export const AuthenticationTokens = Type.Object({
	access_token: Type.String(),
	id_token: Type.String(),
	refresh_token: Type.Optional(Type.String()),
}, { $id: "AuthenticationTokens" });

export const AuthenticationGetCeremonyResponse = Type.Union([
	Type.Object({
		state: Type.Optional(AuthenticationEncryptedState),
		ceremony: AuthenticationCeremony,
		current: AuthenticationComponent,
	}, { $id: "AuthenticationCeremonyStep" }),
	AuthenticationTokens,
], { $id: "AuthenticationGetCeremonyResponse" });

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
			let currentSession: (Session & SessionMeta) | undefined;
			if (context.request.headers.has("Authorization")) {
				const authorization = context.request.headers.get("Authorization") ?? "";
				const [, scheme, accessToken] =
					authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/) ?? [];
				if (scheme === "Bearer") {
					try {
						const { payload } = await jwtVerify(
							accessToken,
							configuration.keys.publicKey,
						);
						if (isID("sess_", payload.sub)) {
							const sess = await configuration.sessionProvider.get(payload.sub).catch(
								(_) => undefined,
							);
							if (sess) {
								const { scope, aat } = { scope: "", aat: 0, ...payload };
								currentSession = {
									...sess,
									scope: scope.split(/ +/),
									aat,
								};
							}
						}
					} catch (error) {
						console.error(error);
					}
					if (!currentSession) {
						throw new ForbiddenError();
					}
				}
			}
			return {
				currentSession,
				notification: configuration.notificationProvider,
				session: configuration.sessionProvider,
			};
		})
		.collection(["identities"], { schema: Identity })
		.collection(["identities", "{identityId}", "components"], { schema: IdentityComponent })
		.document(["identifications", "{kind}", "{identification}"], { schema: ID("id_") })
		.onDocumentSaving(
			["identities", "{identityId}", "components", "{kind}"],
			async ({ params, atomic, context, document }) => {
				// When new identity component is created with an identification, ensure that it's unique in the identifications collection
				if (document.identification) {
					const doc = await context.document.get([
						"identifications",
						document.componentId,
						document.identification,
					]).catch((_) => null);

					// If not already present, set the identification
					if (!doc) {
						atomic
							.check(["identifications", params.kind, document.identification], null)
							.set(
								["identifications", params.kind, document.identification],
								document.identityId,
							);
					}
				}
			},
		)
		.onDocumentDeleting(
			["identities", "{identityId}", "components", "{kind}"],
			async ({ document, atomic }) => {
				// When identity component is deleted with an identification, ensure that it's removed from the identifications collection
				if (document.identification) {
					atomic.delete([
						"identifications",
						document.componentId,
						document.identification,
					]);
				}
			},
		)
		.rpc(["authentication", "signOut"], {
			input: Type.Void(),
			output: Type.Boolean(),
			security: async () => "allow",
			handler: async ({ context }) => {
				if (context.currentSession) {
					await context.session.delete(context.currentSession.sessionId);
					return true;
				}
				return false;
			},
		})
		.rpc(["authentication", "refreshAccessToken"], {
			input: Type.Object({
				refresh_token: Type.String(),
			}),
			output: AuthenticationTokens,
			security: async () => "allow",
			handler: async (
				{ input: { refresh_token }, context },
			) => {
				const { payload } = await jwtVerify(refresh_token, configuration.keys.publicKey);
				const { sub: sessionId, scope } = payload;
				assertID("sess_", sessionId);
				const session = await context.session.get(sessionId);
				const identity = await context.document.get([
					"identities",
					session.identityId,
				]);
				await context.session.set(
					session,
					refreshTokenTTL ?? accessTokenTTL ?? 1000 * 60 * 2,
				);
				const { access_token, id_token } = await createTokens(
					identity.data,
					session,
					`${scope}`,
				);
				return { access_token, id_token, refresh_token };
			},
		})
		.rpc(["authentication", "getCeremony"], {
			input: AuthenticationEncryptedState,
			output: AuthenticationGetCeremonyResponse,
			security: async () => "allow",
			handler: async ({ input, context }) => {
				const state = await decryptAuthenticationState(input);
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
				state: AuthenticationEncryptedState,
			}),
			output: AuthenticationGetCeremonyResponse,
			security: async () => "allow",
			handler: async ({ input, context }) => {
				const state = await decryptAuthenticationState(input.state);
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
				const identityComponentProvider = configuration.identityComponentProviders.find((
					icp,
				) => icp.id === currentComponent.component);
				if (!identityComponentProvider) {
					throw new UnknownIdentityComponentError();
				}
				const identityComponent = state.identityId
					? await context.document.get([
						"identities",
						state.identityId,
						"components",
						input.id,
					]).then((doc) => doc.data).catch((_) => undefined)
					: undefined;

				if (identityComponent && identityComponent.confirmed === false) {
					throw new AuthenticationSubmitPromptError();
				}
				const result = await identityComponentProvider.verifySignInPrompt({
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
				const encryptedState = await encryptAuthenticationState(state);
				return { ceremony, current, state: encryptedState };
			},
		})
		.rpc(["authentication", "sendPrompt"], {
			input: Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: AuthenticationEncryptedState,
			}),
			output: Type.Boolean(),
			security: async () => "allow",
			handler: async ({ input, context }) => {
				const state = await decryptAuthenticationState(input.state);
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
				const identityComponentProvider = configuration.identityComponentProviders.find((
					icp,
				) => icp.id === currentComponent.component);
				if (!identityComponentProvider) {
					throw new UnknownIdentityComponentError();
				}
				const identityComponent = state.identityId
					? await context.document.get([
						"identities",
						state.identityId,
						"components",
						input.id,
					]).then((doc) => doc.data).catch((_) => undefined)
					: undefined;

				if (!identityComponent || identityComponent.confirmed === false) {
					return false;
				}
				const result = await identityComponentProvider.sendSignInPrompt({
					context,
					locale: input.locale,
					identityComponent,
				});
				return result;
			},
		});

	async function createTokens(
		identity: Identity,
		session: Session,
		scope = "*",
		authorizedAt = Date.now() / 1000 >> 0,
	): Promise<{ access_token: string; id_token: string; refresh_token?: string }> {
		const now = Date.now();
		const access_token = await new SignJWT({ scope, aat: authorizedAt })
			.setSubject(session.sessionId)
			.setIssuedAt()
			.setExpirationTime((now + accessTokenTTL) / 1000 >> 0)
			.setProtectedHeader({ alg: configuration.keys.algo })
			.sign(configuration.keys.privateKey);
		const id_token = await new SignJWT({ data: identity.data })
			.setSubject(session.identityId)
			.setIssuedAt()
			.setProtectedHeader({ alg: configuration.keys.algo })
			.sign(configuration.keys.privateKey);
		const refresh_token = await new SignJWT({ scope })
			.setSubject(session.sessionId)
			.setIssuedAt(authorizedAt)
			.setExpirationTime((now + refreshTokenTTL) / 1000 >> 0)
			.setProtectedHeader({ alg: configuration.keys.algo })
			.sign(configuration.keys.privateKey);
		return { access_token, id_token, refresh_token };
	}

	async function encryptAuthenticationState(
		state: AuthenticationState,
	): Promise<string> {
		const now = Date.now();
		return new SignJWT(state as unknown as JWTPayload)
			.setProtectedHeader({ alg: configuration.keys.algo })
			.setIssuedAt()
			.setExpirationTime((now + ceremonyTTL) / 1000 >> 0)
			.sign(configuration.keys.privateKey);
	}

	async function decryptAuthenticationState(
		encryptedState: string | undefined,
	): Promise<AuthenticationState> {
		if (!encryptedState) {
			return {};
		}
		try {
			const { payload } = await jwtVerify<AuthenticationState>(
				encryptedState,
				configuration.keys.publicKey,
			);
			return payload;
		} catch (_) {
			return {};
		}
	}

	async function mapCeremonyToComponent(
		context: AuthenticationContext,
		ceremony: AuthenticationCeremonyComponent | AuthenticationCeremonyChoiceShallow,
	): Promise<AuthenticationComponent> {
		if (ceremony.kind === "component") {
			const identityComponent = configuration.identityComponentProviders.find((icp) =>
				icp.id === ceremony.component
			);
			if (!identityComponent) {
				throw new UnknownIdentityComponentError();
			}
			return identityComponent.getSignInPrompt({ context });
		} else {
			const component: AuthenticationComponent = {
				kind: "choice",
				prompts: await Promise.all(
					ceremony.components.map(async (component) => {
						const identityComponent = configuration.identityComponentProviders
							.find((icp) => icp.id === component.component);
						if (!identityComponent) {
							throw new UnknownIdentityComponentError();
						}
						return identityComponent.getSignInPrompt({ context });
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
		const session: Session = {
			identityId: identity.data.identityId,
			sessionId: id("sess_"),
			data: {},
		};
		const scope = "";
		const { access_token, id_token, refresh_token } = await createTokens(
			identity.data,
			session,
			`${scope}`,
		);
		return { access_token, id_token, refresh_token };
	}
}

export class InvalidAuthenticationStateError extends Error {}
export class UnknownIdentityComponentError extends Error {}
export class AuthenticationSubmitPromptError extends Error {}
