import { IContext } from "../../../common/server/context.ts";
import { getJsonData } from "../get_json_data.ts";

export async function signOut(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
) {
	// const data = await getJsonData(request);
	// const session = data.session?.toString() ?? "";
	// await context.session.destroy(session);
	throw new Error("Not implemented");
	return {};
}
