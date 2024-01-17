import {
	HighRiskActionTimeWindowExpiredError,
	IdentityComponentDeleteError,
} from "../../../client/errors.ts";
import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function deleteIdentityComponent(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<void> {
	if (!context.authenticationToken) {
		throw new UnauthorizedError();
	}
	const identityId = context.authenticationToken.sessionData.identityId;
	const data = await getJsonData(request);
	const component = data?.component?.toString() ?? "";
	if (
		context.authenticationToken.lastAuthorizationTime >=
			Date.now() / 1000 + context.config.auth.highRiskActionTimeWindow
	) {
		throw new HighRiskActionTimeWindowExpiredError();
	}
	try {
		const identity = await context.identity.get(identityId);
		delete identity.components[component];
		await context.identity.update(identity);
	} catch (_error) {
		throw new IdentityComponentDeleteError();
	}
}
