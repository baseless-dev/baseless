import { IContext } from "../../../common/server/context.ts";

export async function signOut(
	request: Request,
	_params: Record<never, never>,
	context: IContext,
) {
	const formData = await request.formData();
	const session = formData.get("session")?.toString() ?? "";
	await context.session.destroy(session);
	return {};
}
