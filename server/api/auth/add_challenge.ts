import {
	HighRiskActionTimeWindowExpiredError,
	UnauthorizedError,
} from "../../../common/auth/errors.ts";
import { IdentityChallengeCreateError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function addChallenge(
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
	const challengeType = data?.challengeType?.toString() ?? "";
	const challenge = data?.challenge?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!challenge) {
		throw new IdentityChallengeCreateError();
	}
	if (
		context.tokenData.lastAuthorizationTime >=
			Date.now() / 1000 + context.config.auth.highRiskActionTimeWindow
	) {
		throw new HighRiskActionTimeWindowExpiredError();
	}
	try {
		const identity = await context.identity.get(identityId);
		const meta = await context.identity.getChallengeMeta(
			challengeType,
			challenge,
		);
		if (identity.challenges[challengeType]) {
			throw new IdentityChallengeCreateError();
		}
		identity.challenges[challengeType] = {
			type: challengeType,
			confirmed: false,
			meta,
		};
		await context.identity.update(identity);
		await context.identity.sendChallengeValidationCode(
			identityId,
			challengeType,
			locale,
		);
	} catch (_error) {
		throw new IdentityChallengeCreateError();
	}
}
