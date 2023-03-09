import { Router } from "../router.ts";
import { Context } from "../context.ts";

const authRouter = new Router<[context: Context]>();

authRouter.get("/login", (request, _params, context) => {
	return context.config.auth.views?.login(request, context.config.auth) ?? new Response(undefined, { status: 501 });
});

authRouter.post("/login", async (request, _params, _context) => {
	const post = await request.formData();
	const _email = post.get("not_an_email") ?? post.get("email");
	// TODO validate email in auth flow
	// TODO get Identity by email
	// TODO begin login flow
	return new Response(null, { status: 301 });
});

authRouter.get("/login/email", (_request, _params, _context) => {
	// TODO validate email in auth flow
	// TODO get email login method
	// TODO present oneOf or redirect
	return new Response(null, { status: 301 });
});

authRouter.get("/login/email/password", (_request, _params, _context) => {
	// TODO validate email in auth flow
	// TODO validate password in login flow
	// TODO present password input
	return new Response(null, { status: 301 });
});

authRouter.post("/login/email/password", (_request, _params, _context) => {
	// TODO validate email in auth flow
	// TODO validate password in login flow
	// TODO present password input
	return new Response(null, { status: 301 });
});

export default authRouter;
