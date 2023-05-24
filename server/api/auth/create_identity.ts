import { CreateIdentityError } from "../../../common/auth/errors.ts";
import type { IContext } from "../../../common/server/context.ts";
import { AutoId } from "../../../common/system/autoid.ts";
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
		throw new CreateIdentityError();
	}

	let identityId: AutoId | undefined;
	try {
		// Claim anonymous identity or create new one
		if (context.sessionData) {
			const identifications = await context.identity.listIdentification(
				context.sessionData.identityId,
			);
			if (identifications.length === 0) {
				identityId = context.sessionData.identityId;
			} else {
				throw new CreateIdentityError();
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
			verified: false,
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
			if (!context.sessionData) {
				await context.identity.delete(identityId).catch((_) => {});
			}
		}
		throw new CreateIdentityError();
	}
}
