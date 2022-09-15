import { ssr, memoSSR } from "./ssr.ts";
import { h } from "https://deno.land/x/nano_jsx@v0.0.32/mod.ts";
import Login from "./Login.tsx";
import { Context } from "https://baseless.dev/x/baseless/context.ts";

export const routes = new Map<URLPattern, (context: Context, request: Request, params: Record<string, string>) => Response | Promise<Response>>();

routes.set(new URLPattern({ pathname: "/login" }), (_ctx, req) => {
	return ssr(() => <Login />);
});

export default async function handleAuth(context: Context, request: Request): Promise<Response | undefined> {
	for (const [route, handler] of routes) {
		const matches = route.exec(request.url);
		if (matches) {
			return await handler(context, request, matches.pathname.groups);
		}
	}
}
