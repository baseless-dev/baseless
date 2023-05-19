import { SendIdentificationValidationCodeResponse } from "../../../common/auth/send_identification_validation_code_response.ts";
import { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function sendIdentificationValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<SendIdentificationValidationCodeResponse> {
	try {
		const data = await getJsonData(request);
		const type = data.type?.toString() ?? "";
		const identification = data.identification?.toString() ?? "";
		// TODO default locale
		const locale = data.locale?.toString() ?? "en";
		const identityIdentification = await context.identity.matchIdentification(
			type,
			identification,
		);
		await context.identity.sendIdentificationValidationCode(
			identityIdentification.identityId,
			type,
			locale,
		);
		return { sent: true };
	} catch (_error) {
		return { sent: false };
	}
}
