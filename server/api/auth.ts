import { RouteHandler, RouterBuilder } from "../../common/system/router.ts";
import type { ApiResponse } from "../../common/api/response.ts";
import type { IContext } from "../../common/server/context.ts";
import { confirmIdentificationValidationCode } from "./auth/confirm_identification_validation_code.ts";
import { getAuthenticationCeremony } from "./auth/get_authentication_ceremony.ts";
import { sendIdentificationChallenge } from "./auth/send_identification_challenge.ts";
import { sendIdentificationValidationCode } from "./auth/send_identification_validation_code.ts";
import { signOut } from "./auth/sign_out.ts";
import { submitAuthenticationChallenge } from "./auth/submit_authentication_challenge.ts";
import { submitAuthenticationIdentification } from "./auth/submit_authentication_identification.ts";
import { createAnonymousIdentity } from "./auth/create_anonymous_identity.ts";
import { createIdentity } from "./auth/create_identity.ts";
import { addIdentification } from "./auth/add_identification.ts";
import { addChallenge } from "./auth/add_challenge.ts";
import { confirmChallengeValidationCode } from "./auth/confirm_challenge_validation_code.ts";
import { sendChallengeValidationCode } from "./auth/send_challenge_validation_code.ts";

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

authRouter.get("/getAuthenticationCeremony", json(getAuthenticationCeremony));
authRouter.post("/getAuthenticationCeremony", json(getAuthenticationCeremony));
authRouter.post(
	"/submitAuthenticationIdentification",
	json(submitAuthenticationIdentification),
);
authRouter.post(
	"/submitAuthenticationChallenge",
	json(submitAuthenticationChallenge),
);
authRouter.post(
	"/sendIdentificationChallenge",
	json(sendIdentificationChallenge),
);
authRouter.post(
	"/sendIdentificationValidationCode",
	json(sendIdentificationValidationCode),
);
authRouter.post(
	"/confirmIdentificationValidationCode",
	json(confirmIdentificationValidationCode),
);
authRouter.post("/signOut", json(signOut));
authRouter.post("/createAnonymousIdentity", json(createAnonymousIdentity));
authRouter.post("/createIdentity", json(createIdentity));
authRouter.post("/addIdentification", json(addIdentification));
authRouter.post("/addChallenge", json(addChallenge));
authRouter.post(
	"/sendChallengeValidationCode",
	json(sendChallengeValidationCode),
);
authRouter.post(
	"/confirmChallengeValidationCode",
	json(confirmChallengeValidationCode),
);

export default authRouter;
