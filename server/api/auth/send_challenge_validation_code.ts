import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { SendChallengeValidationCodeResponse } from "../../../common/auth/send_challenge_validation_code_response.ts";
import { IdentityChallengeNotFoundError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function sendChallengeValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<SendChallengeValidationCodeResponse> {
	if (!context.tokenData) {
		throw new UnauthorizedError();
	}
	try {
		const identityId = context.tokenData.sessionData.identityId;
		const data = await getJsonData(request);
		const type = data.type?.toString() ?? "";
		// TODO default locale
		const locale = data.locale?.toString() ?? "en";
		const identity = await context.identity.get(identityId);
		const identityChallenge = identity.challenges[type];
		if (!identityChallenge) {
			throw new IdentityChallengeNotFoundError();
		}
		await context.identity.sendChallengeValidationCode(
			identity.id,
			type,
			locale,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}
