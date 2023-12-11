import type { AuthenticationCeremonyResponseTokens } from "../../../common/auth/ceremony/response.ts";
import {
	IdentityComponentNotFoundError,
	IdentityCreateError,
} from "../../../common/identity/errors.ts";
import type { Identity } from "../../../common/identity/identity.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";
import { createTokens } from "./create_tokens.ts";

function assertIdentityComponentIdIdentification(
	value: unknown,
): asserts value is Array<{ id: string; prompt: unknown }> {
	if (
		!value || !Array.isArray(value) ||
		!value.every((item) =>
			!!item && typeof item === "object" &&
			"id" in item && typeof item.id === "string" &&
			"prompt" in item && item.prompt
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
	const components = data?.components ?? [];
	// TODO default locale
	const _locale = data?.locale?.toString() ?? "en";

	assertIdentityComponentIdIdentification(components);

	const identityComponents: Identity["components"] = {};
	for (const { id, prompt } of components) {
		const identityComponent = context.config.auth.components.get(id);
		if (!identityComponent) {
			throw new IdentityComponentNotFoundError();
		}
		identityComponents[id] = {
			id: id,
			identification: identityComponent.getIdentityComponentIdentification
				? await identityComponent
					.getIdentityComponentIdentification({
						context,
						value: prompt,
					})
				: undefined,
			meta: await identityComponent
				.getIdentityComponentMeta({
					context,
					value: prompt,
				}),
			confirmed: false,
		};
	}
	try {
		// Claim anonymous identity or create new one
		if (context.tokenData) {
			const identity = await context.identity.get(
				context.tokenData.sessionData.identityId,
			);
			if (Object.keys(identity.components).length > 0) {
				throw new IdentityCreateError();
			}
			for (const { id } of components) {
				identity.components[id] = identityComponents[id];
			}
			await context.identity.update(identity);
		} else {
			const identity = await context.identity.create({}, identityComponents);
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
