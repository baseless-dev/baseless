import { RouterBuilder } from "../../common/system/router.ts";
import { ApiResponse } from "../../common/api/response.ts";
import { IContext } from "../../common/server/context.ts";
import { confirmIdentificationValidationCode } from "./auth/confirm_identification_validation_code.ts";
import { getAuthenticationCeremony } from "./auth/get_authentication_ceremony.ts";
import { sendIdentificationChallenge } from "./auth/send_identification_challenge.ts";
import { sendIdentificationValidationCode } from "./auth/send_identification_validation_code.ts";
import { signOut } from "./auth/sign_out.ts";
import { submitAuthenticationChallenge } from "./auth/submit_authentication_challenge.ts";
import { submitAuthenticationIdentification } from "./auth/submit_authentication_identification.ts";

function json<Params, Result>(
	handler: (
		request: Request,
		params: Params,
		context: IContext,
	) => Result | Promise<Result>,
	headers = new Headers(),
) {
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

export default authRouter;
