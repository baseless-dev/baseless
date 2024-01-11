import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./api/auth/decrypt_encrypted_authentication_ceremony_state.ts";
import { type BaselessContext, Router, t } from "./baseless.ts";
import type { AuthenticationCeremonyComponent } from "../common/auth/ceremony/ceremony.ts";
import type { AuthenticationComponent } from "../common/auth/component.ts";
import type { PartialRequired } from "../common/system/types.ts";

export type AuthenticationKeys = {
	algo: string;
	privateKey: KeyLike;
	publicKey: KeyLike;
};

export type RateLimitOptions = {
	count: number;
	interval: number;
};

export type AuthenticationOptions = {
	keys: AuthenticationKeys;
	salt: string;
	rateLimit: RateLimitOptions;
	accessTokenTTL: number;
	refreshTokenTTL: number;
	allowAnonymousIdentity: boolean;
	ceremonyComponent: AuthenticationCeremonyComponent;
	highRiskActionTimeWindow: number;
};

// deno-lint-ignore explicit-function-return-type
export default function auth(
	options: PartialRequired<
		AuthenticationOptions,
		"keys" | "salt" | "ceremonyComponent"
	>,
) {
	const opts: AuthenticationOptions = {
		rateLimit: { count: 10, interval: 60 },
		accessTokenTTL: 1000 * 60 * 10,
		refreshTokenTTL: 1000 * 60 * 60 * 24 * 7,
		allowAnonymousIdentity: false,
		highRiskActionTimeWindow: 60 * 5,
		...options,
	};
	return new Router<[BaselessContext]>()
		.get("/getAuthenticationCeremony", (_req, _input, ctx) => {
			return Response.json(ctx.auth.getAuthenticationCeremony());
		})
		.post("/getAuthenticationCeremony", async (_req, { body }, ctx) => {
			const state = await decryptEncryptedAuthenticationCeremonyState(
				body.state,
				opts.keys.publicKey,
			);
			return Response.json(ctx.auth.getAuthenticationCeremony(state));
		}, { body: t.Object({ state: t.String() }, ["state"]) });
}
