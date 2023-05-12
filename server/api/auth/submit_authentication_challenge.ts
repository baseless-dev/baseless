import { AuthenticationCeremonyResponse } from "../../../common/auth/ceremony/response.ts";
import { assertAuthenticationCeremonyStateIdentified } from "../../../common/auth/ceremony/state.ts";
import { Context } from "../../../common/server/context.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";
import { encryptAuthenticationCeremonyState } from "./encrypt_authentication_ceremony_state.ts";

export async function submitAuthenticationChallenge(
	request: Request,
	_params: Record<never, never>,
	context: Context,
): Promise<AuthenticationCeremonyResponse> {
	const formData = await request.formData();
	const type = formData.get("type")?.toString() ?? "";
	const challenge = formData.get("challenge")?.toString() ?? "";
	const encryptedState = formData.get("state")?.toString() ?? "";
	const state = await decryptEncryptedAuthenticationCeremonyState(
		encryptedState,
		context.config.auth.security.keys.publicKey,
	);
	assertAuthenticationCeremonyStateIdentified(state);
	const result = await context.auth.submitAuthenticationChallenge(
		state,
		type,
		challenge,
		state.identity,
	);
	if (result.done) {
		const session = await context.session.create(result.identityId, {});
		return { done: true, identityId: session.identityId };
	} else {
		return {
			...result,
			...("state" in result
				? {
					encryptedState: await encryptAuthenticationCeremonyState(
						result.state,
						context.config.auth.security.keys.algo,
						context.config.auth.security.keys.privateKey,
					),
				}
				: {}),
		};
	}
}