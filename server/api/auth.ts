import {
	type RouteHandler,
	RouterBuilder,
} from "../../common/system/router.ts";
import type { ApiResponse } from "../../common/api/response.ts";
import { createAnonymousIdentity } from "./auth/create_anonymous_identity.ts";
import { createIdentity } from "./auth/create_identity.ts";
import { addIdentityComponent } from "./auth/add_component.ts";
import { deleteIdentityComponent } from "./auth/delete_component.ts";
import { updateIdentityComponent } from "./auth/update_component.ts";

function json<Params extends Record<string, string | undefined>, Result>(
	handler: (
		request: Request,
		params: Params,
		context: IContext,
	) => Result | Promise<Result>,
	headers = new Headers(),
): RouteHandler<Params, [context: IContext]> {
	headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
	headers.set("Content-Type", "application/json");
	return async (request: Request, params: Params, context: IContext) => {
		let result: ApiResponse;
		try {
			result = {
				data: await handler(request, params, context) as Record<
					string,
					unknown
				>,
			};
		} catch (error) {
			result = { error: error.constructor.name };
		}
		return new Response(JSON.stringify(result), {
			status: 200,
			headers,
		});
	};
}

const authRouter = new RouterBuilder<[context: IContext]>();

authRouter.post("/createAnonymousIdentity", json(createAnonymousIdentity));
authRouter.post("/createIdentity", json(createIdentity));
authRouter.post("/addIdentityComponent", json(addIdentityComponent));
authRouter.post("/deleteIdentityComponent", json(deleteIdentityComponent));
authRouter.post("/updateIdentityComponent", json(updateIdentityComponent));
// authRouter.post(
// 	"/confirmIdentityComponentValidationCode",
// 	json(confirmIdentityComponentValidationCode),
// );
// authRouter.post(
// 	"/sendIdentityComponentValidationCode",
// 	json(sendIdentityComponentValidationCode),
// );
// authRouter.post(
// 	"/sendAuthenticationComponentPrompt",
// 	json(sendAuthenticationComponentPrompt),
// );
// authRouter.post(
// 	"/submitAuthenticationComponentPrompt",
// 	json(submitAuthenticationComponentPrompt),
// );
// authRouter.get("/getAuthenticationCeremony", json(getAuthenticationCeremony));
// authRouter.post("/getAuthenticationCeremony", json(getAuthenticationCeremony));
// authRouter.post("/refreshTokens", json(refreshTokens));
// authRouter.post("/signOut", json(signOut));

export default authRouter;
