// deno-lint-ignore-file require-await
import { JWTPayload, jwtVerify, type KeyLike, SignJWT } from "jose";
import { assertSession, isSession, type Session } from "@baseless/core/authentication";
import { assertID, ID, id, isID, TID } from "@baseless/core/id";
import { Identity, IdentityComponent } from "@baseless/core/identity";
import { ApplicationBuilder } from "../applicationbuilder.ts";
import { ForbiddenError } from "../application.ts";
import {
	CollectionDefinitionWithoutSecurity,
	DocumentDefinitionWithoutSecurity,
	RpcDefinition,
} from "../types.ts";
import { TBoolean, TObject, TOptional, TString, TUnknown, TVoid, Type } from "@sinclair/typebox";
import {
	AuthenticationCeremony,
	AuthenticationCeremonyChoiceShallow,
	AuthenticationCeremonyComponent,
	getAuthenticationCeremonyComponentAtPath,
	simplifyAuthenticationCeremony,
} from "./ceremony.ts";
import { isAuthenticationCeremonyChoice } from "./ceremony.ts";

export interface AuthenticationConfiguration {
	keys: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	ceremony: AuthenticationCeremony;
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
	currentSession: (Session & SessionMeta) | undefined;
}

interface AuthenticationState {
	identityId?: ID<"id_">;
	choices?: string[];
}

export const AuthenticationState = Type.String({ $id: "AuthenticationState" });

export const AuthenticationTokens = Type.Object({
	access_token: Type.String(),
	id_token: Type.String(),
	refresh_token: Type.Optional(Type.String()),
}, { $id: "AuthenticationTokens" });

export const AuthenticationGetCeremonyResponse = Type.Union([
	Type.Object({
		first: Type.Boolean(),
		last: Type.Boolean(),
		component: Type.Union([
			AuthenticationCeremonyComponent,
			AuthenticationCeremonyChoiceShallow,
		]),
	}, { $id: "AuthenticationCeremonyStep" }),
	AuthenticationTokens,
], { $id: "AuthenticationGetCeremonyResponse" });

export function configureAuthentication(
	configuration: AuthenticationConfiguration,
): ApplicationBuilder<
	AuthenticationDecoration,
	[
		RpcDefinition<["authentication", "signOut"], TVoid, TBoolean>,
		RpcDefinition<
			["authentication", "refreshAccessToken"],
			TObject<{ refresh_token: TString }>,
			typeof AuthenticationTokens
		>,
		RpcDefinition<
			["authentication", "getCeremony"],
			typeof AuthenticationState,
			typeof AuthenticationGetCeremonyResponse
		>,
		RpcDefinition<
			["authentication", "submitPrompt"],
			TObject<{ id: TString; value: TUnknown; state: typeof AuthenticationState }>,
			typeof AuthenticationGetCeremonyResponse
		>,
		RpcDefinition<
			["authentication", "sendPrompt"],
			TObject<{ id: TString; locale: TString; state: typeof AuthenticationState }>,
			TBoolean
		>,
	],
	[],
	[
		DocumentDefinitionWithoutSecurity<
			["identifications", "{kind}", "{identification}"],
			TID<"id_">
		>,
	],
	[
		CollectionDefinitionWithoutSecurity<["identities"], typeof Identity>,
		CollectionDefinitionWithoutSecurity<
			["identities", "{identityId}", "components"],
			typeof IdentityComponent
		>,
	]
> {
	const accessTokenTTL = configuration.accessTokenTTL ?? 1000 * 60 * 10;
	const refreshTokenTTL = configuration.refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 2;
	const ceremonyTTL = configuration.ceremonyTTL ?? 1000 * 60 * 5;
	const ceremony = simplifyAuthenticationCeremony(configuration.ceremony);

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
		encryptedState: string,
	): Promise<AuthenticationState> {
		const { payload } = await jwtVerify<AuthenticationState>(
			encryptedState,
			configuration.keys.publicKey,
		);
		return payload;
	}

	return new ApplicationBuilder()
		.decorate(async ({ request, kv }) => {
			let currentSession: (Session & SessionMeta) | undefined;
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
						if (isID("sess_", payload.sub)) {
							const key = await kv.get(["session", payload.sub]);
							if (isSession(key.value)) {
								const { scope, aat } = { scope: "", aat: 0, ...payload };
								currentSession = { ...key.value, scope: scope.split(/ +/), aat };
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
			return { currentSession };
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
						document.kind,
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
					atomic.delete(["identifications", document.kind, document.identification]);
				}
			},
		)
		.rpc(["authentication", "signOut"], {
			input: Type.Void(),
			output: Type.Boolean(),
			security: async () => "allow",
			handler: async ({ context: { currentSession, kv } }) => {
				if (currentSession) {
					await kv.delete(["session", currentSession.sessionId]);
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
				{ input: { refresh_token }, context: { kv, document } },
			) => {
				const { payload } = await jwtVerify(refresh_token, configuration.keys.publicKey);
				const { sub: sessionId, scope } = payload;
				assertID("sess_", sessionId);
				const session = await kv.get(["session", sessionId]);
				assertSession(session.value);
				const identity = await document.get([
					"identities",
					session.value.identityId,
				]);
				await kv.put(["session", sessionId], session.value, {
					expiration: refreshTokenTTL ?? accessTokenTTL ?? 1000 * 60 * 2,
				});
				const { access_token, id_token } = await createTokens(
					identity.data,
					session.value,
					`${scope}`,
				);
				return { access_token, id_token, refresh_token };
			},
		})
		.rpc(["authentication", "getCeremony"], {
			input: AuthenticationState,
			output: AuthenticationGetCeremonyResponse,
			security: async () => "allow",
			handler: async ({ input, context: { document } }) => {
				const state = await decryptAuthenticationState(input);
				const choices = state.choices ?? [];
				const currentComponent = getAuthenticationCeremonyComponentAtPath(
					ceremony,
					choices,
				);
				if (currentComponent === undefined) {
					throw new InvalidAuthenticationStateError();
				}
				if (currentComponent === true) {
					const identity = await document.get([
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
				const first = choices.length === 0;
				const last = isAuthenticationCeremonyChoice(currentComponent)
					? false
					: getAuthenticationCeremonyComponentAtPath(ceremony, [
						...choices,
						currentComponent.component,
					]) === true;

				// TODO return AuthenticationComponent instead of AuthenticationCeremony
				return { first, last, component: currentComponent };
			},
		})
		.rpc(["authentication", "submitPrompt"], {
			input: Type.Object({
				id: Type.String(),
				value: Type.Unknown(),
				state: AuthenticationState,
			}),
			output: AuthenticationGetCeremonyResponse,
			security: async () => "allow",
			handler: async ({ input, context: { document } }) => {
				throw "TODO";
			},
		})
		.rpc(["authentication", "sendPrompt"], {
			input: Type.Object({
				id: Type.String(),
				locale: Type.String(),
				state: AuthenticationState,
			}),
			output: Type.Boolean(),
			security: async () => "allow",
			handler: async ({ input, context: { document } }) => {
				throw "TODO";
			},
		});
}

export class InvalidAuthenticationStateError extends Error {}
