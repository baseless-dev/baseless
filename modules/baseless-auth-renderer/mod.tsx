import { memoSSR, ssr } from "./ssr.ts";
import { h } from "https://deno.land/x/nano_jsx@v0.0.32/mod.ts";
import Login from "./Login.tsx";
import { Context } from "https://baseless.dev/x/baseless/context.ts";
import { AuthenticationType } from "../baseless/auth/signInMethod.ts";

export const routes = new Map<URLPattern, (context: Context, request: Request, params: Record<string, string>) => Response | Promise<Response>>();

routes.set(new URLPattern({ pathname: "/login" }), (ctx, req) => {
	return ssr(() => <Login signInFlow={ctx.config.auth.signInFlow} />);
});

export default async function handleAuth(context: Context, request: Request): Promise<Response | undefined> {
	for (const [route, handler] of routes) {
		const matches = route.exec(request.url);
		if (matches) {
			return await handler(context, request, matches.pathname.groups);
		}
	}
}
