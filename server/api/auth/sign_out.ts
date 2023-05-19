import { UnauthorizedError } from "../../../common/auth/errors.ts";
import { IContext } from "../../../common/server/context.ts";

export async function signOut(
	_request: Request,
	_params: Record<never, never>,
	context: IContext,
) {
	if (context.sessionData) {
		try {
			await context.session.destroy(context.sessionData.id);
			return {};
		} catch (_error) {
			// skip
		}
	}
	throw new UnauthorizedError();
}
