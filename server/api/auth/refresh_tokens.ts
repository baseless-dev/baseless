import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import type { AuthenticationTokens } from "../../../common/auth/tokens.ts";
import type { IContext } from "../../../common/server/context.ts";
import { assertAutoId } from "../../../common/system/autoid.ts";
import { createTokens } from "./create_tokens.ts";

export async function refreshTokens(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<AuthenticationTokens> {
	if (request.method === "POST") {
		const refreshToken = request.headers.get("X-Refresh-Token");
		if (refreshToken) {
			const { payload } = await jwtVerify(
				refreshToken,
				context.config.auth.security.keys.publicKey,
			);
			const { sub: sessionId, scope } = payload;
			assertAutoId(sessionId, "ses-");
			const sessionData = await context.session.get(sessionId);
			const identity = await context.identity.get(sessionData.identityId);
			await context.session.update(
				sessionData,
				context.config.auth.expirations.refreshToken,
			);
			const { access_token, id_token } = await createTokens(
				identity,
				sessionData,
				context.config.auth.security.keys.algo,
				context.config.auth.security.keys.privateKey,
				context.config.auth.expirations.accessToken,
				context.config.auth.expirations.refreshToken,
				`${scope}`,
			);
			return {
				access_token,
				id_token,
				refresh_token: refreshToken,
			};
		}
	}
	throw new Error("unimplemented");
}
