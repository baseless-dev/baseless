import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import type { SessionData } from "../../../common/session/data.ts";

export async function createTokens(
	sessionData: SessionData,
	alg: string,
	privateKey: KeyLike,
	accessExpiration: string | number = "10m",
	refreshExpiration: string | number = "1w",
): Promise<{ access_token: string; id_token: string; refresh_token?: string }> {
	const access_token = await new SignJWT({})
		.setSubject(sessionData.id)
		.setIssuedAt()
		.setExpirationTime(accessExpiration)
		.setProtectedHeader({ alg })
		.sign(privateKey);
	// TODO identity meta
	const id_token = await new SignJWT({})
		.setSubject(sessionData.identityId)
		.setIssuedAt()
		.setProtectedHeader({ alg })
		.sign(privateKey);
	const refresh_token = await new SignJWT({ scope: "*" })
		.setSubject(sessionData.identityId)
		.setIssuedAt()
		.setExpirationTime(refreshExpiration)
		.setProtectedHeader({ alg })
		.sign(privateKey);
	return { access_token, id_token, refresh_token };
}
