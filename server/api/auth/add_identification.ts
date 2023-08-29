import {
	HighRiskActionTimeWindowExpiredError,
	UnauthorizedError,
} from "../../../common/auth/errors.ts";
import { IdentityIdentificationCreateError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function addIdentification(
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
	const identificationType = data?.identificationType?.toString() ?? "";
	const identification = data?.identification?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!identification) {
		throw new IdentityIdentificationCreateError();
	}
	if (
		context.tokenData.lastAuthorizationTime >=
			Date.now() / 1000 + context.config.auth.highRiskActionTimeWindow
	) {
		throw new HighRiskActionTimeWindowExpiredError();
	}
	try {
		await context.identity.createIdentification({
			identityId,
			type: identificationType,
			identification,
			meta: {},
			confirmed: false,
		});
		await context.identity.sendIdentificationValidationCode(
			identityId,
			identificationType,
			locale,
		);
	} catch (_error) {
		throw new IdentityIdentificationCreateError();
	}
}