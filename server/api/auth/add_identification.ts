import { UnauthorizedError } from "../../../common/auth/errors.ts";
import { IdentityIdentificationCreateError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function addIdentification(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<void> {
	if (!context.sessionData) {
		throw new UnauthorizedError();
	}
	const identityId = context.sessionData.identityId;
	const data = await getJsonData(request);
	const identificationType = data?.identificationType?.toString() ?? "";
	const identification = data?.identification?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";
	if (!identification) {
		throw new IdentityIdentificationCreateError();
	}
	try {
		await context.identity.createIdentification({
			identityId,
			type: identificationType,
			identification,
			meta: {},
			verified: false,
		});
		await context.identity.sendIdentificationValidationCode(
			identityId,
			identificationType,
			locale,
		);
	} catch (_error) {
		throw new IdentityIdentificationCreateError();
	}
}
