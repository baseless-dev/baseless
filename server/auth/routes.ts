import { RouterBuilder } from "../router.ts";
import { Context } from "../context.ts";

const authRouter = new RouterBuilder<[context: Context]>();

// Redirect all requests to SPA
authRouter.get("/*", (request, _params, context) => {
	const url = new URL(request.url);
	url.pathname = "/auth/index.html";
	const redirected = new Request(url, request);
	return context.asset.fetch(redirected);
});

export default authRouter;
