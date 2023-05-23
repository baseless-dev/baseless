import type { AuthenticationCeremonyResponse } from "../../../common/auth/ceremony/response.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";

export async function getAuthenticationCeremony(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<AuthenticationCeremonyResponse> {
	if (request.method === "POST") {
		const data = await getJsonData(request);
		const encryptedState = data?.state?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationCeremonyState(
			encryptedState,
			context.config.auth.security.keys.publicKey,
		);
		return context.auth.getAuthenticationCeremony(state);
	}
	return context.auth.getAuthenticationCeremony();
}
