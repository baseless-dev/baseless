import {
	type RouteHandler,
	RouterBuilder,
} from "../../common/system/router.ts";
import type { ApiResponse } from "../../common/api/response.ts";
import type { IContext } from "../../common/server/context.ts";
import { getAuthenticationCeremony } from "./auth/get_authentication_ceremony.ts";
import { signOut } from "./auth/sign_out.ts";
import { createAnonymousIdentity } from "./auth/create_anonymous_identity.ts";
import { createIdentity } from "./auth/create_identity.ts";
import { refreshTokens } from "./auth/refresh_tokens.ts";
import { addComponent } from "./auth/add_component.ts";
import { confirmComponentValidationCode } from "./auth/confirm_component_validation_code.ts";
import { deleteComponent } from "./auth/delete_component.ts";
import { sendComponentValidationCode } from "./auth/send_component_validation_code.ts";
import { submitAuthenticationPrompt } from "./auth/submit_authentication_prompt.ts";
import { updateComponent } from "./auth/update_component.ts";

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

authRouter.post("/addComponent", json(addComponent));
authRouter.post(
	"/confirmComponentValidationCode",
	json(confirmComponentValidationCode),
);
authRouter.post("/createAnonymousIdentity", json(createAnonymousIdentity));
authRouter.post("/createIdentity", json(createIdentity));
authRouter.post("/deleteComponent", json(deleteComponent));
authRouter.get("/getAuthenticationCeremony", json(getAuthenticationCeremony));
authRouter.post("/getAuthenticationCeremony", json(getAuthenticationCeremony));
authRouter.post("/refreshTokens", json(refreshTokens));
authRouter.post(
	"/sendComponentValidationCode",
	json(sendComponentValidationCode),
);
authRouter.post("/signOut", json(signOut));
authRouter.post(
	"/submitAuthenticationPrompt",
	json(submitAuthenticationPrompt),
);
authRouter.post("/updateComponent", json(updateComponent));

export default authRouter;
