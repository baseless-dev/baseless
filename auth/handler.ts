import { Context } from "../server/context.ts";

export default async function AuthHandler(
	request: Request,
	_param: Record<never, never>,
	context: Context,
) {
	const response = await context.asset.fetch(request);
	if (response.status !== 404) {
		return response;
	}
	const url = new URL(request.url);
	url.pathname = "/auth/index.html";
	request = new Request(url, { ...request });
	return context.asset.fetch(request);
}
