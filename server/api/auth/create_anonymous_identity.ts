import type { AuthenticationCeremonyResponseTokens } from "../../../common/auth/ceremony/response/tokens.ts";
import { AnonymousIdentityNotAllowedError } from "../../../common/auth/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { createTokens } from "./create_tokens.ts";

export async function createAnonymousIdentity(
	_request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<AuthenticationCeremonyResponseTokens> {
	if (!context.config.auth.allowAnonymousIdentity) {
		throw new AnonymousIdentityNotAllowedError();
	}
	const identity = await context.identity.create({});
	// TODO session expiration
	const sessionData = await context.session.create(identity.id, {});
	// TODO longer tokens expiration?
	const { access_token, id_token, refresh_token } = await createTokens(
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
}
