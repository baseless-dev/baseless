import {
	HighRiskActionTimeWindowExpiredError,
	UnauthorizedError,
} from "../../../common/auth/errors.ts";
import {
	IdentityComponentCreateError,
	IdentityComponentExistsError,
} from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function addComponent(
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
	const component = data?.component?.toString();
	const prompt = data?.prompt as unknown;
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!component || !prompt) {
		throw new IdentityComponentCreateError();
	}
	const identityComponent = context.config.auth.components.get(component);
	if (!identityComponent) {
		throw new IdentityComponentCreateError();
	}
	if (
		context.tokenData.lastAuthorizationTime >=
			Date.now() / 1000 + context.config.auth.highRiskActionTimeWindow
	) {
		throw new HighRiskActionTimeWindowExpiredError();
	}
	const identity = await context.identity.get(identityId);
	if (identity.components[component]) {
		throw new IdentityComponentExistsError();
	}
	identity.components[component] = {
		id: "prompt",
		identification: identityComponent.getIdentityComponentIdentification
			? await identityComponent
				.getIdentityComponentIdentification({
					context,
					value: prompt,
				})
			: "",
		meta: await identityComponent.getIdentityComponentMeta({
			context,
			value: prompt,
		}),
		confirmed: false,
	};
	try {
		await context.identity.update(identity);
		await context.identity.sendComponentValidationCode(
			identityId,
			component,
			locale,
		);
	} catch (_error) {
		throw new IdentityComponentCreateError();
	}
}