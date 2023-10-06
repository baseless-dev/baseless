import type { ConfirmIdentificationValidationCodeResponse } from "../../../common/auth/confirm_identification_validation_code_response.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function confirmIdentificationValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<ConfirmIdentificationValidationCodeResponse> {
	try {
		const data = await getJsonData(request);
		const type = data.type?.toString() ?? "";
		const identification = data.identification?.toString() ?? "";
		const code = data.code?.toString() ?? "";
		const identity = await context.identity.getByIdentification(
			type,
			identification,
		);
		await context.identity.confirmIdentificationValidationCode(
			identity.id,
			type,
			code,
		);
		return { confirmed: true };
	} catch (_error) {
		return { confirmed: false };
	}
}
