import { UnauthorizedError } from "../../../common/auth/errors.ts";
import type { IContext } from "../../../common/server/context.ts";

export async function signOut(
	_request: Request,
	_params: Record<never, never>,
	context: IContext,
	// deno-lint-ignore ban-types
): Promise<{}> {
	if (context.currentSessionData) {
		try {
			await context.session.destroy(context.currentSessionData.id);
			return {};
		} catch (_error) {
			// skip
		}
	}
	throw new UnauthorizedError();
}
