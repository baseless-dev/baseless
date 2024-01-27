import { jwtVerify, type KeyLike } from "../../deps.ts";
import type {
	AuthenticationSignInState,
	AuthenticationSignUpState,
} from "../../lib/auth/types.ts";

export async function decryptEncryptedAuthenticationCeremonyState(
	data: string,
	publicKey: KeyLike,
): Promise<AuthenticationSignInState | AuthenticationSignUpState> {
	const { payload } = await jwtVerify(data, publicKey);
	return payload as any;
}
