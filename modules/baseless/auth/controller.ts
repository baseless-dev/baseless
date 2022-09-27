import { Router } from "../router.ts";
import { Context } from "../context.ts";

const authRouter = new Router<{ context: Context }>();

authRouter.get("/login", ({ request, context }) => {
	return context.config.auth.views?.login(request, context.config.auth) ?? new Response(undefined, { status: 501 });
});

authRouter.post("/login", async ({ request, context }) => {
	const post = await request.formData();
	const email = post.get("not_an_email") ?? post.get("email");
	return new Response(null, { status: 301 });
});

export default authRouter;