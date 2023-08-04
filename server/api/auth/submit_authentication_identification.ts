import type { AuthenticationCeremonyResponse } from "../../../common/auth/ceremony/response.ts";
import { isAuthenticationCeremonyResponseDone } from "../../../common/auth/ceremony/response/done.ts";
import {
	type AuthenticationCeremonyState,
	isAuthenticationCeremonyStateIdentified,
} from "../../../common/auth/ceremony/state.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { createTokens } from "./create_tokens.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";
import { encryptAuthenticationCeremonyState } from "./encrypt_authentication_ceremony_state.ts";

export async function submitAuthenticationIdentification(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<AuthenticationCeremonyResponse> {
	const data = await getJsonData(request);
	const type = data?.type?.toString() ?? "";
	const identification = data?.identification?.toString() ?? "";
	const encryptedState = data?.state?.toString() ?? "";
	const state = await decryptEncryptedAuthenticationCeremonyState(
		encryptedState,
		context.config.auth.security.keys.publicKey,
	);
	const subject = isAuthenticationCeremonyStateIdentified(state)
		? state.identity
		: context.remoteAddress;
	const result = await context.auth.submitAuthenticationIdentification(
		state,
		type,
		identification,
		subject,
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
			context.config.auth.expirations.accessToken,
			context.config.auth.expirations.refreshToken,
		);
		return {
			done: true,
			access_token,
			id_token,
			refresh_token,
		};
	} else {
		const { state, ...rest } =
			result as (typeof result & { state?: AuthenticationCeremonyState });
		return {
			...rest,
			...(state
				? {
					encryptedState: await encryptAuthenticationCeremonyState(
						state,
						context.config.auth.security.keys.algo,
						context.config.auth.security.keys.privateKey,
					),
				}
				: {}),
		} as typeof result;
	}
}
