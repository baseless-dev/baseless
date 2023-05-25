import type { ConfirmChallengeValidationCodeResponse } from "../../../common/auth/confirm_challenge_validation_code_response.ts";
import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function confirmChallengeValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<ConfirmChallengeValidationCodeResponse> {
	if (!context.sessionData) {
		throw new UnauthorizedError();
	}
	try {
		const identityId = context.sessionData.identityId;
		const data = await getJsonData(request);
		const type = data.type?.toString() ?? "";
		const answer = data.answer?.toString() ?? "";
		await context.identity.confirmChallengeValidationCode(
			identityId,
			type,
			answer,
		);
		return { confirmed: true };
	} catch (_error) {
		return { confirmed: false };
	}
}
