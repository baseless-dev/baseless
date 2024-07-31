// deno-lint-ignore-file require-await
import { isID } from "@baseless/core/id";
import { Application } from "./application.ts";
import { type KVProvider } from "./provider.ts";
import { isSession, type Session } from "@baseless/core/authentication";
import { jwtVerify, type KeyLike } from "jose";
import { type TBoolean, type TObject, type TString, type TVoid, Type } from "@sinclair/typebox";
import { RpcDefinitionWithSecurity } from "./types.ts";

export interface AuthenticationOptions {
	kvProvider: KVProvider;
	keys: {
		algo: string;
		privateKey: KeyLike;
		publicKey: KeyLike;
	};
}

export interface SessionMeta {
	scope: string[];
	aat: number;
}

export interface AuthenticationDecoration {
	currentSession: (Session & SessionMeta) | undefined;
	kvProvider: KVProvider;
}

export function createAuthenticationApplication(
	{ kvProvider, keys }: AuthenticationOptions,
): Application<
	AuthenticationDecoration,
	[
		RpcDefinitionWithSecurity<
			["authentication", "signOut"],
			AuthenticationDecoration,
			TVoid,
			TBoolean
		>,
		RpcDefinitionWithSecurity<
			["authentication", "refreshAccessToken"],
			AuthenticationDecoration,
			TObject<{ refresh_token: TString }>,
			TBoolean
		>,
	]
> {
	return new Application()
		.decorate(async ({ request }) => {
			let currentSession: (Session & SessionMeta) | undefined;
			if (request.headers.has("Authorization")) {
				const authorization = request.headers.get("Authorization") ?? "";
				const [, scheme, accessToken] = authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/) ?? [];
				if (scheme === "Bearer") {
					try {
						const { payload } = await jwtVerify(accessToken, keys.publicKey);
						if (isID("sess_", payload.sub)) {
							const key = await kvProvider.get(["session", payload.sub]);
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
			return { currentSession, kvProvider };
		})
		.rpc(["authentication", "signOut"], {
			input: Type.Void(),
			output: Type.Boolean(),
			security: async () => "allow",
			handler: async ({ context: { currentSession, kvProvider } }) => {
				if (currentSession) {
					await kvProvider.delete(["session", currentSession.sessionId]);
					return true;
				}
				return false;
			},
		});
}
