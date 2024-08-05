// deno-lint-ignore-file require-await
import { assertID, ID, isID, TID } from "@baseless/core/id";
import { Application } from "./application.ts";
import { assertSession, isSession, type Session } from "@baseless/core/authentication";
import { jwtVerify, type KeyLike, SignJWT } from "jose";
import { type TBoolean, type TObject, type TString, type TVoid, Type } from "@sinclair/typebox";
import { CollectionDefinitionWithoutSecurity, RpcDefinitionWithSecurity } from "./types.ts";
import { assertIdentity, Identity, IdentityComponent } from "@baseless/core/identity";
import { DocumentDefinitionWithoutSecurity } from "./types.ts";

export interface AuthenticationOptions {
	keys: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
	accessTokenTTL: number;
	refreshTokenTTL?: number;
}

export interface SessionMeta {
	scope: string[];
	aat: number;
}

export type AuthenticationDecoration = {
	currentSession: (Session & SessionMeta) | undefined;
};

export function createAuthenticationApplication(
	{ keys, refreshTokenTTL, accessTokenTTL }: AuthenticationOptions,
): Application<
	AuthenticationDecoration,
	[
		RpcDefinitionWithSecurity<
			["authentication", "signOut"],
			AuthenticationDecoration,
			any,
			any,
			TVoid,
			TBoolean
		>,
		RpcDefinitionWithSecurity<
			["authentication", "refreshAccessToken"],
			AuthenticationDecoration,
			any,
			any,
			TObject<{ refresh_token: TString }>,
			TObject<{ access_token: TString; id_token: TString; refresh_token: TString }>
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
	return new Application()
		.decorate(async ({ request, kv }) => {
			let currentSession: (Session & SessionMeta) | undefined;
			if (request.headers.has("Authorization")) {
				const authorization = request.headers.get("Authorization") ?? "";
				const [, scheme, accessToken] =
					authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/) ?? [];
				if (scheme === "Bearer") {
					try {
						const { payload } = await jwtVerify(accessToken, keys.publicKey);
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
				}
			}
			return { currentSession };
		})
		.collection(["identities"], { schema: Identity })
		.collection(["identities", "{identityId}", "components"], { schema: IdentityComponent })
		.document(["identifications", "{kind}", "{identification}"], { schema: ID("id_") })
		/*.onDocumentCreating(["identities", "{identityId}", "components"], async ({ document, atomic }) => {
			atomic
				.notExists(["identifications", document.kind, document.identification])
				.set(["identifications", document.kind, document.identification], document.identityId);
		})
		.onDocumentDeleting(["identities", "{identityId}", "components"], async ({ document, atomic }) => {
			atomic.delete(["identifications", document.kind, document.identification]);
		})*/
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
			output: Type.Object({
				access_token: Type.String(),
				id_token: Type.String(),
				refresh_token: Type.String(),
			}),
			security: async () => "allow",
			handler: async (
				{ input: { refresh_token }, context: { kv, document } },
			) => {
				const { payload } = await jwtVerify(refresh_token, keys.publicKey);
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
					keys.algo,
					keys.privateKey,
					accessTokenTTL ?? 1000 * 60 * 10,
					refreshTokenTTL ?? 1000 * 60 * 60 * 24 * 7,
					`${scope}`,
				);
				return { access_token, id_token, refresh_token };
			},
		});
}

export async function createTokens(
	identity: Identity,
	session: Session,
	alg: string,
	privateKey: KeyLike,
	accessExpiration: number,
	refreshExpiration: number,
	scope = "*",
	authorizedAt = Date.now() / 1000 >> 0,
): Promise<{ access_token: string; id_token: string; refresh_token?: string }> {
	const now = Date.now();
	const access_token = await new SignJWT({ scope, aat: authorizedAt })
		.setSubject(session.sessionId)
		.setIssuedAt()
		.setExpirationTime((now + accessExpiration) / 1000 >> 0)
		.setProtectedHeader({ alg })
		.sign(privateKey);
	const id_token = await new SignJWT({ data: identity.data })
		.setSubject(session.identityId)
		.setIssuedAt()
		.setProtectedHeader({ alg })
		.sign(privateKey);
	const refresh_token = await new SignJWT({ scope })
		.setSubject(session.sessionId)
		.setIssuedAt(authorizedAt)
		.setExpirationTime((now + refreshExpiration) / 1000 >> 0)
		.setProtectedHeader({ alg })
		.sign(privateKey);
	return { access_token, id_token, refresh_token };
}
