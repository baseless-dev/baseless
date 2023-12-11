import type { ConfirmIdentificationValidationCodeResponse } from "../../../common/auth/confirm_identification_validation_code_response.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function confirmComponentValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<ConfirmIdentificationValidationCodeResponse> {
	try {
		const data = await getJsonData(request);
		const code = data.code?.toString() ?? "";
		await context.identity.confirmComponentValidationCode(code);
		return { confirmed: true };
	} catch (_error) {
		return { confirmed: false };
	}
}
