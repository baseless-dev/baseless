import { assertAuthenticationCeremonyStateIdentified } from "../../../common/auth/ceremony/state.ts";
import { SendIdentificationChallengeResponse } from "../../../common/auth/send_identification_challenge_response.ts";
import { Context } from "../../../common/server/context.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";

export async function sendIdentificationChallenge(
	request: Request,
	_params: Record<never, never>,
	context: Context,
): Promise<SendIdentificationChallengeResponse> {
	try {
		const formData = await request.formData();
		const type = formData.get("type")?.toString() ?? "";
		const encryptedState = formData.get("state")?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationCeremonyState(
			encryptedState,
			context.config.auth.security.keys.publicKey,
		);
		assertAuthenticationCeremonyStateIdentified(state);
		await context.auth.sendIdentificationChallenge(
			state.identity,
			type,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}