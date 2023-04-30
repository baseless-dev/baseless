import { RouterBuilder } from "../router.ts";
import { Context } from "../context.ts";

const authRouter = new RouterBuilder<[context: Context]>();

// authRouter.get("/*", async (request, _params, context) => {
// 	return await context.asset.fetch(request);
// });

export default authRouter;
