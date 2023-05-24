import { IdentityChallengeExistsError } from "../../../client/errors.ts";
import { UnauthorizedError } from "../../../common/auth/errors.ts";
import { IdentityChallengeCreateError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function addChallenge(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<void> {
	if (!context.sessionData) {
		throw new UnauthorizedError();
	}
	const identityId = context.sessionData.identityId;
	const data = await getJsonData(request);
	const challengeType = data?.challengeType?.toString() ?? "";
	const challenge = data?.challenge?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!challenge) {
		throw new IdentityChallengeCreateError();
	}
	const identityChallenge = await context.identity.getChallenge(
		identityId,
		challengeType,
	).catch((_) => undefined);
	if (identityChallenge) {
		throw new IdentityChallengeExistsError();
	}
	try {
		await context.identity.createChallenge(
			identityId,
			challengeType,
			challenge,
		);
		await context.identity.sendChallenge(identityId, challengeType, locale);
	} catch (_error) {
		throw new IdentityChallengeCreateError();
	}
}
