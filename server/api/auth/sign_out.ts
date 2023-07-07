import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { IContext } from "../../../common/server/context.ts";

export async function signOut(
	_request: Request,
	_params: Record<never, never>,
	context: IContext,
	// deno-lint-ignore ban-types
): Promise<{}> {
	if (context.tokenData) {
		try {
			await context.session.destroy(context.tokenData.sessionData.id);
			return {};
		} catch (_error) {
			// skip
		}
	}
	throw new UnauthorizedError();
}
