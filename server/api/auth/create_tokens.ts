import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import type { SessionData } from "../../../common/session/data.ts";
import type { ID } from "../../../common/identity/identity.ts";

export async function createTokens(
	identity: ID,
	sessionData: SessionData,
	alg: string,
	privateKey: KeyLike,
	accessExpiration: number,
	refreshExpiration: number,
	scope = "*",
	authorizedAt = Date.now() / 1000 >> 0,
): Promise<{ access_token: string; id_token: string; refresh_token?: string }> {
	const now = Date.now();
	const access_token = await new SignJWT({ scope, aat: authorizedAt })
		.setSubject(sessionData.id)
		.setIssuedAt()
		.setExpirationTime((now + accessExpiration) / 1000 >> 0)
		.setProtectedHeader({ alg })
		.sign(privateKey);
	const id_token = await new SignJWT({ meta: identity.meta })
		.setSubject(identity.id)
		.setIssuedAt()
		.setProtectedHeader({ alg })
		.sign(privateKey);
	const refresh_token = await new SignJWT({ scope })
		.setSubject(sessionData.id)
		.setIssuedAt(authorizedAt)
		.setExpirationTime((now + refreshExpiration) / 1000 >> 0)
		.setProtectedHeader({ alg })
		.sign(privateKey);
	return { access_token, id_token, refresh_token };
}
