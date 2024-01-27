import { type JWTPayload, type KeyLike, SignJWT } from "../../deps.ts";
import type {
	AuthenticationSignInState,
	AuthenticationSignUpState,
} from "../../lib/auth/types.ts";

export async function encryptAuthenticationCeremonyState(
	state: AuthenticationSignInState | AuthenticationSignUpState,
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
