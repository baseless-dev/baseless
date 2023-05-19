import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { SessionData } from "../../../common/session/data.ts";

export async function createTokens(
	sessionData: SessionData,
	alg: string,
	privateKey: KeyLike,
	expiration: string | number = "10m",
): Promise<{ access_token: string; id_token: string; refresh_token?: string }> {
	const access_token = sessionData.id;
	const id_token = await new SignJWT({})
		.setSubject(sessionData.identityId)
		.setIssuedAt()
		.setProtectedHeader({ alg })
		.sign(privateKey);
	const refresh_token = await new SignJWT({ scope: "*" })
		.setSubject(sessionData.identityId)
		.setIssuedAt()
		.setExpirationTime(expiration)
		.setProtectedHeader({ alg })
		.sign(privateKey);
	return { access_token, id_token, refresh_token };
}
