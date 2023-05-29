import type { AuthenticationCeremonyResponse } from "../../../common/auth/ceremony/response.ts";
import { isAuthenticationCeremonyResponseDone } from "../../../common/auth/ceremony/response/done.ts";
import { assertAuthenticationCeremonyStateIdentified } from "../../../common/auth/ceremony/state.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { createTokens } from "./create_tokens.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";
import { encryptAuthenticationCeremonyState } from "./encrypt_authentication_ceremony_state.ts";

export async function submitAuthenticationChallenge(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<AuthenticationCeremonyResponse> {
	const data = await getJsonData(request);
	const type = data?.type?.toString() ?? "";
	const challenge = data?.challenge?.toString() ?? "";
	const encryptedState = data?.state?.toString() ?? "";
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
	if (isAuthenticationCeremonyResponseDone(result)) {
		const identity = await context.identity.get(result.identityId);
		// TODO session expiration
		const sessionData = await context.session.create(result.identityId, {});
		const { access_token, id_token, refresh_token } = await createTokens(
			identity,
			sessionData,
			context.config.auth.security.keys.algo,
			context.config.auth.security.keys.privateKey,
		);
		return {
			done: true,
			access_token,
			id_token,
			refresh_token,
		};
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
