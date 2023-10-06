import type { AuthenticationCeremonyResponseTokens } from "../../../common/auth/ceremony/response.ts";
import { IdentityCreateError } from "../../../common/identity/errors.ts";
import type { Identity } from "../../../common/identity/identity.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { createTokens } from "./create_tokens.ts";

function assertTypeId(
	value: unknown,
): asserts value is Array<{ id: string; value: string }> {
	if (
		!value || !Array.isArray(value) ||
		!value.every((item) =>
			!!item && typeof item === "object" &&
			"id" in item && typeof item.id === "string" &&
			"value" in item && typeof item.value === "string"
		)
	) {
		throw new IdentityCreateError();
	}
}

export async function createIdentity(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<AuthenticationCeremonyResponseTokens | undefined> {
	const data = await getJsonData(request);
	const identifications = data?.identifications ?? [];
	const challenges = data?.challenges ?? [];
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";

	assertTypeId(identifications);
	assertTypeId(challenges);

	try {
		// Claim anonymous identity or create new one
		if (context.tokenData) {
			const identity = await context.identity.get(
				context.tokenData.sessionData.identityId,
			);
			if (Object.keys(identity.identifications).length > 0) {
				throw new IdentityCreateError();
			}
			for (const { id, value } of identifications) {
				identity.identifications[id] = {
					type: id,
					identification: value,
					meta: {},
					confirmed: false,
				};
			}
			for (const { id, value } of challenges) {
				const challenger = context.config.auth.challengers.get(id);
				if (!challenger) throw new IdentityCreateError();
				identity.challenges[id] = {
					type: id,
					meta: await challenger?.configureIdentityChallenge?.({
						context,
						challenge: value,
					}) ?? {},
					confirmed: false,
				};
			}
			await context.identity.update(identity);
		} else {
			const identityMeta = {};
			const identityIdentifications: Identity["identifications"] = {};
			const identityChallenges: Identity["challenges"] = {};
			for (const { id, value } of identifications) {
				identityIdentifications[id] = {
					type: id,
					identification: value,
					meta: {},
					confirmed: false,
				};
			}
			for (const { id, value } of challenges) {
				const challenger = context.config.auth.challengers.get(id);
				if (!challenger) throw new IdentityCreateError();
				identityChallenges[id] = {
					type: id,
					meta: await challenger?.configureIdentityChallenge?.({
						context,
						challenge: value,
					}) ?? {},
					confirmed: false,
				};
			}
			const identity = await context.identity.create(
				identityMeta,
				identityIdentifications,
				identityChallenges,
			);
			// TODO longer tokens expiration?
			const sessionData = await context.session.create(
				identity.id,
				{},
				context.config.auth.expirations.refreshToken,
			);
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
		}
	} catch (_error) {
		throw new IdentityCreateError();
	}
}
