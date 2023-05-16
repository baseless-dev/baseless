import { AuthenticationCeremonyResponse } from "../../../common/auth/ceremony/response.ts";
import { isAuthenticationCeremonyStateIdentified } from "../../../common/auth/ceremony/state.ts";
import { Context } from "../../../common/server/context.ts";
import { decryptEncryptedAuthenticationCeremonyState } from "./decrypt_encrypted_authentication_ceremony_state.ts";
import { encryptAuthenticationCeremonyState } from "./encrypt_authentication_ceremony_state.ts";

export async function submitAuthenticationIdentification(
	request: Request,
	_params: Record<never, never>,
	context: Context,
): Promise<AuthenticationCeremonyResponse> {
	const formData = await request.formData();
	const type = formData.get("type")?.toString() ?? "";
	const identification = formData.get("identification")?.toString() ?? "";
	const encryptedState = formData.get("state")?.toString() ?? "";
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
