import { HighRiskActionTimeWindowExpiredError } from "../../../client/errors.ts";
import { UnauthorizedError } from "../../../common/auth/errors.ts";
import { IdentityChallengeUpdateError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function updateChallenge(
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
	const challenge = data?.challenge?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!challenge) {
		throw new IdentityChallengeUpdateError();
	}
	if (
		context.tokenData.lastAuthorizationTime >=
			Date.now() / 1000 + context.config.auth.highRiskActionTimeWindow
	) {
		throw new HighRiskActionTimeWindowExpiredError();
	}
	try {
		const existingChallenge = await context.identity.getChallenge(
			identityId,
			challengeType,
		);
		if (existingChallenge.identityId !== identityId) {
			throw new IdentityChallengeUpdateError();
		}
		const meta = await context.identity.getChallengeMeta(
			challengeType,
			challenge,
		);
		await context.identity.updateChallenge({
			...existingChallenge,
			meta: {
				...existingChallenge.meta,
				meta,
			},
			confirmed: false,
		});
		await context.identity.sendChallengeValidationCode(
			identityId,
			challengeType,
			locale,
		);
	} catch (_error) {
		throw new IdentityChallengeUpdateError();
	}
}