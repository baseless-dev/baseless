import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { SendChallengeValidationCodeResponse } from "../../../common/auth/send_challenge_validation_code_response.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function sendChallengeValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<SendChallengeValidationCodeResponse> {
	if (!context.currentSessionData) {
		throw new UnauthorizedError();
	}
	try {
		const identityId = context.currentSessionData.identityId;
		const data = await getJsonData(request);
		const type = data.type?.toString() ?? "";
		// TODO default locale
		const locale = data.locale?.toString() ?? "en";
		const identityChallenge = await context.identity.getChallenge(
			identityId,
			type,
		);
		await context.identity.sendChallengeValidationCode(
			identityChallenge.identityId,
			type,
			locale,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}
