import {
	HighRiskActionTimeWindowExpiredError,
	UnauthorizedError,
} from "../../../common/auth/errors.ts";
import {
	IdentityComponentNotFoundError,
	IdentityComponentUpdateError,
} from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function updateComponent(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<void> {
	if (!context.tokenData) {
		throw new UnauthorizedError();
	}
	// TODO need session iat to be "recent"
	const identityId = context.tokenData.sessionData.identityId;
	const data = await getJsonData(request);
	const component = data?.component?.toString() ?? "";
	const prompt = data?.identification?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!prompt) {
		throw new IdentityComponentUpdateError();
	}
	if (
		context.tokenData.lastAuthorizationTime >=
			Date.now() / 1000 + context.config.auth.highRiskActionTimeWindow
	) {
		throw new HighRiskActionTimeWindowExpiredError();
	}
	const identity = await context.identity.get(identityId);
	if (!identity.components[component]) {
		throw new IdentityComponentNotFoundError();
	}
	const identityComponent = context.config.auth.components.get(component);
	if (!identityComponent) {
		throw new IdentityComponentNotFoundError();
	}
	try {
		Object.assign(identity.components[component], {
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
		});
		await context.identity.update(identity);
		await context.identity.sendComponentValidationCode(
			identityId,
			component,
			locale,
		);
	} catch (_error) {
		throw new IdentityComponentUpdateError();
	}
}
