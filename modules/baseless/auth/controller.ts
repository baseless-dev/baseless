import { Context } from "../context.ts";

// deno-lint-ignore require-await
export async function handleLogin(context: Context, request: Request): Promise<Response> {
	if (request.method === 'GET') {
		return context.config.auth.render.login(context, request);
	}
	else if (request.method === 'POST') {
		return new Response(null, {
			status: 501,
		})
	}
	else {
		return new Response(null, { status: 405 })
	}
}