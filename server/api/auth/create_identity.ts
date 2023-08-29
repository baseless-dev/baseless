import { IdentityCreateError } from "../../../common/identity/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import type { AutoId } from "../../../common/system/autoid.ts";
import { getJsonData } from "../get_json_data.ts";

export async function createIdentity(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
): Promise<void> {
	const data = await getJsonData(request);
	const identificationType = data?.identificationType?.toString() ?? "";
	const identification = data?.identification?.toString();
	// TODO default locale
	const locale = data?.locale?.toString() ?? "en";

	if (!identification) {
		throw new IdentityCreateError();
	}

	let identityId: AutoId | undefined;
	try {
		// Claim anonymous identity or create new one
		if (context.tokenData) {
			const identifications = await context.identity.listIdentification(
				context.tokenData.sessionData.identityId,
			);
			if (identifications.length === 0) {
				identityId = context.tokenData.sessionData.identityId;
			} else {
				throw new IdentityCreateError();
			}
		} else {
			const identity = await context.identity.create({});
			identityId = identity.id;
		}
		await context.identity.createIdentification({
			identityId,
			type: identificationType,
			identification,
			meta: {},
			confirmed: false,
		});
		await context.identity.sendIdentificationValidationCode(
			identityId,
			identificationType,
			locale,
		);
	} catch (_error) {
		if (identityId) {
			await context.identity.deleteIdentification(
				identityId,
				identificationType,
				identification,
			).catch((_) => {});
			if (!context.tokenData) {
				await context.identity.delete(identityId).catch((_) => {});
			}
		}
		throw new IdentityCreateError();
	}
}