import type {
	JWTPayload,
	KeyLike,
} from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import type { AuthenticationCeremonyState } from "../../common/auth/ceremony/state.ts";

export async function encryptAuthenticationCeremonyState(
	state: AuthenticationCeremonyState,
	alg: string,
	privateKey: KeyLike,
	expiration: string | number = "10m",
): Promise<string> {
	return await new SignJWT(state as unknown as JWTPayload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(expiration)
		.sign(privateKey);
}
