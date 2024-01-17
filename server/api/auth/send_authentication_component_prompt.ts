import {
	isAuthenticationCeremonyStateIdentified,
} from "../../../common/auth/ceremony/state.ts";
import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { SendComponentPromptResponse } from "../../../common/auth/send_component_prompt_response.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";

export async function sendAuthenticationComponentPrompt(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<SendComponentPromptResponse> {
	try {
		const data = await getJsonData(request);
		const component = data.component?.toString() ?? "";
		const encryptedState = data?.state?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationCeremonyState(
			encryptedState,
			context.config.auth.security.keys.publicKey,
		);
		const identityId = isAuthenticationCeremonyStateIdentified(state)
			? state.identity
			: context.authenticationToken?.sessionData.identityId;
		if (!identityId) {
			throw new UnauthorizedError();
		}
		// TODO default locale
		const locale = data?.locale?.toString() ?? "en";
		await context.identity.sendComponentPrompt(
			identityId,
			component,
			locale,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}
