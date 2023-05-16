import { ConfirmIdentificationValidationCodeResponse } from "../../../common/auth/confirm_identification_validation_code_response.ts";
import { IContext } from "../../../common/server/context.ts";

export async function confirmIdentificationValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<ConfirmIdentificationValidationCodeResponse> {
	try {
		const formData = await request.formData();
		const type = formData.get("type")?.toString() ?? "";
		const identification = formData.get("identification")?.toString() ?? "";
		const code = formData.get("code")?.toString() ?? "";
		const identityIdentification = await context.identity.matchIdentification(
			type,
			identification,
		);
		await context.auth.confirmIdentificationValidationCode(
			identityIdentification.identityId,
			type,
			code,
		);
		return { confirmed: true };
	} catch (_error) {
		return { confirmed: false };
	}
}
