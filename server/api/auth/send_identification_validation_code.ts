import { SendIdentificationValidationCodeResponse } from "../../../common/auth/send_identification_validation_code_response.ts";
import { Context } from "../../../common/server/context.ts";

export async function sendIdentificationValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: Context,
): Promise<SendIdentificationValidationCodeResponse> {
	try {
		const formData = await request.formData();
		const type = formData.get("type")?.toString() ?? "";
		const identification = formData.get("identification")?.toString() ?? "";
		// TODO default locale
		const locale = formData.get("locale")?.toString() ?? "en";
		const identityIdentification = await context.identity.matchIdentification(
			type,
			identification,
		);
		await context.auth.sendIdentificationValidationCode(
			context,
			identityIdentification.identityId,
			type,
			locale,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}