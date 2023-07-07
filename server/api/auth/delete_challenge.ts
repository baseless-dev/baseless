import { HighRiskActionTimeWindowExpiredError } from "../../../client/errors.ts";
import { UnauthorizedError } from "../../../common/auth/errors.ts";
import { IdentityChallengeDeleteError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function deleteChallenge(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<void> {
	if (!context.tokenData) {
		throw new UnauthorizedError();
	}
	const identityId = context.tokenData.sessionData.identityId;
	const data = await getJsonData(request);
	const challengeType = data?.challengeType?.toString() ?? "";
	if (
		context.tokenData.lastAuthorizationTime >=
			Date.now() / 1000 + context.config.auth.highRiskActionTimeWindow
	) {
		throw new HighRiskActionTimeWindowExpiredError();
	}
	try {
		await context.identity.deleteChallenge(identityId, challengeType);
	} catch (_error) {
		throw new IdentityChallengeDeleteError();
	}
}
