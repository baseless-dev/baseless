import {
	isAuthenticationCeremonyStateIdentified,
} from "../../../common/auth/ceremony/state.ts";
import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { SendComponentValidationCodeResponse } from "../../../common/auth/send_component_validation_code_response.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";

export async function sendIdentityComponentValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<SendComponentValidationCodeResponse> {
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
			: context.tokenData?.sessionData.identityId;
		if (!identityId) {
			throw new UnauthorizedError();
		}
		// TODO default locale
		const locale = data?.locale?.toString() ?? "en";
		await context.identity.sendComponentValidationCode(
			identityId,
			component,
			locale,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}
