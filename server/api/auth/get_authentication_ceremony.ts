import { AuthenticationCeremonyResponse } from "../../../common/auth/ceremony/response.ts";
import { IContext } from "../../../common/server/context.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";

export async function getAuthenticationCeremony(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<AuthenticationCeremonyResponse> {
	if (request.method === "POST") {
		const formData = await request.formData();
		const encryptedState = formData.get("state")?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationCeremonyState(
			encryptedState,
			context.config.auth.security.keys.publicKey,
		);
		return context.auth.getAuthenticationCeremony(state);
	}
	return context.auth.getAuthenticationCeremony();
}
