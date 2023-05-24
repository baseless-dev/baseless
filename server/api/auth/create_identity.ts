import { CreateIdentityError } from "../../../common/auth/errors.ts";
import type { Identity } from "../../../common/identity/identity.ts";
import type { IContext } from "../../../common/server/context.ts";
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

	let identity: Identity | undefined;
	try {
		identity = await context.identity.create({});
		await context.identity.createIdentification({
			identityId: identity.id,
			type: identificationType,
			identification,
			meta: {},
			verified: false,
		});
		await context.identity.sendIdentificationValidationCode(
			identity.id,
			identificationType,
			locale,
		);
	} catch (_error) {
		if (identity) {
			await Promise.allSettled([
				context.identity.deleteIdentification(
					identity.id,
					identificationType,
					identification,
				),
				context.identity.delete(identity.id),
			]);
		}
		throw new CreateIdentityError();
	}
}
