import { assertAuthenticationCeremonyStateIdentified } from "../../../common/auth/ceremony/state.ts";
import { SendIdentificationChallengeResponse } from "../../../common/auth/send_identification_challenge_response.ts";
import { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";

export async function sendIdentificationChallenge(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<SendIdentificationChallengeResponse> {
	try {
		const data = await getJsonData(request);
		const type = data.type?.toString() ?? "";
		const encryptedState = data.state?.toString() ?? "";
		// TODO default locale
		const locale = data.locale?.toString() ?? "en";
		const state = await decryptEncryptedAuthenticationCeremonyState(
			encryptedState,
			context.config.auth.security.keys.publicKey,
		);
		assertAuthenticationCeremonyStateIdentified(state);
		await context.identity.sendChallenge(
			state.identity,
			type,
			locale,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}
