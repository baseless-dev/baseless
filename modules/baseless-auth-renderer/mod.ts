import { memoSSR, ssr } from "./ssr.ts";
import Login from "./Login.ts";
import { Context } from "https://baseless.dev/x/baseless/context.ts";
import { Resources } from "./resources.ts";

export default function createRenderer(resources: Resources) {
	const routes = new Map<URLPattern, (context: Context, request: Request, params: Record<string, string>) => Response | Promise<Response>>();

	routes.set(new URLPattern({ pathname: "/login" }), (ctx, req) => {
		return ssr(() => Login({ resources, signInFlow: ctx.config.auth.signInFlow }));
	});

	return async function handleAuth(context: Context, request: Request): Promise<Response | undefined> {
		for (const [route, handler] of routes) {
			const matches = route.exec(request.url);
			if (matches) {
				return await handler(context, request, matches.pathname.groups);
			}
		}
	};
}
