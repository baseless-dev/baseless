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

export async function updateIdentityComponent(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<void> {
	if (!context.authenticationToken) {
		throw new UnauthorizedError();
	}
	// TODO need session iat to be "recent"
	const identityId = context.authenticationToken.sessionData.identityId;
	const data = await getJsonData(request);
	const component = data?.component?.toString() ?? "";
	const prompt = data?.identification?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!prompt) {
		throw new IdentityComponentUpdateError();
	}
	if (
		context.authenticationToken.lastAuthorizationTime >=
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
			confirmed: false,
			...await identityComponent.getIdentityComponentMeta?.({
				context,
				value: prompt,
			}),
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
