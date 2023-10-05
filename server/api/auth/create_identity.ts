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

	let identity: Identity | undefined;
	try {
		// Claim anonymous identity or create new one
		if (context.tokenData) {
			const identityIdentifications = await context.identity.listIdentification(
				context.tokenData.sessionData.identityId,
			);
			if (identityIdentifications.length === 0) {
				identity = await context.identity.get(
					context.tokenData.sessionData.identityId,
				);
			} else {
				throw new IdentityCreateError();
			}
		} else {
			identity = await context.identity.create({});
		}
		for (const { id, value } of identifications) {
			const identificator = context.config.auth.identificators.get(id);
			if (!identificator) throw new IdentityCreateError();
			await context.identity.createIdentification({
				identityId: identity.id,
				type: id,
				identification: value,
				meta: {},
				confirmed: false,
			});
			await context.identity.sendIdentificationValidationCode(
				identity.id,
				id,
				locale,
			);
		}
		for (const { id, value } of challenges) {
			const challenger = context.config.auth.challengers.get(id);
			if (!challenger) throw new IdentityCreateError();
			await context.identity.createChallenge({
				identityId: identity.id,
				type: id,
				meta: await challenger?.configureIdentityChallenge?.({
					context,
					challenge: value,
				}) ?? {},
				confirmed: false,
			});
			// await context.identity.sendIdentificationValidationCode(
			// 	identity.id,
			// 	id,
			// 	locale,
			// );
		}
		if (!context.tokenData) {
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
		if (identity) {
			for (const { id } of identifications) {
				await context.identity.deleteIdentification(
					identity.id,
					id,
				).catch((_) => {});
			}
			if (!context.tokenData) {
				await context.identity.delete(identity.id).catch((_) => {});
			}
		}
		throw new IdentityCreateError();
	}
}
