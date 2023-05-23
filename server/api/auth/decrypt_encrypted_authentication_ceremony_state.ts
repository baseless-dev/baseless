import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import {
	assertAuthenticationCeremonyState,
	type AuthenticationCeremonyState,
} from "../../../common/auth/ceremony/state.ts";

export async function decryptEncryptedAuthenticationCeremonyState(
	data: string,
	publicKey: KeyLike,
): Promise<AuthenticationCeremonyState> {
	try {
		const { payload } = await jwtVerify(data, publicKey);
		assertAuthenticationCeremonyState(payload);
		return payload;
	} catch (_error) {
		return { choices: [] };
	}
}
