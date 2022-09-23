import { Router } from "../router.ts";
import { Context } from "../context.ts";

const authRouter = new Router<{ context: Context }>();

authRouter.get("/login", ({ request, context }) => {
	return context.config.auth.views?.login(request, context.config.auth) ?? new Response(undefined, { status: 500 });
});

export default authRouter;