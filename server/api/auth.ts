import { Context } from "../context.ts";
import type {
	JWTPayload,
	KeyLike,
} from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import {
	assertAuthenticationCeremonyState,
	assertAuthenticationCeremonyStateIdentified,
	AuthenticationCeremonyState,
	isAuthenticationCeremonyStateIdentified,
} from "../../common/authentication/ceremony/state.ts";
import { RouterBuilder } from "../../common/system/router.ts";
import { ApiResult } from "../../common/api/result.ts";

async function decryptEncryptedAuthenticationCeremonyState(
	data: string,
	publicKey: KeyLike,
): Promise<AuthenticationCeremonyState> {
	try {
		const { payload } = await jwtVerify(data, publicKey);
		assertAuthenticationCeremonyState(payload);
		return payload;
	} catch (_error) {
		return { choices: [] };
	}
}

async function encryptAuthenticationCeremonyState(
	state: AuthenticationCeremonyState,
	alg: string,
	privateKey: KeyLike,
	expiration: string | number = "10m",
): Promise<string> {
	return await new SignJWT(state as unknown as JWTPayload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(expiration)
		.sign(privateKey);
}

function json<Params, Result>(
	handler: (
		request: Request,
		params: Params,
		context: Context,
	) => Result | Promise<Result>,
	headers = new Headers(),
) {
	headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
	headers.set("Content-Type", "application/json");
	return async (request: Request, params: Params, context: Context) => {
		let result: ApiResult;
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

function getFlowHandler(
	_request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	return context.config.auth.flow.step;
}

function getSignInStep(
	_request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	return context.auth.getStep();
}

async function postSignInStep(
	request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	const formData = await request.formData();
	const encryptedState = formData.get("state")?.toString() ?? "";
	const state = await decryptEncryptedAuthenticationCeremonyState(
		encryptedState,
		context.config.auth.security.keys.publicKey,
	);
	return context.auth.getStep(state, context);
}

async function postSignInSubmitIdentification(
	request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	const formData = await request.formData();
	const type = formData.get("type")?.toString() ?? "";
	const identification = formData.get("identification")?.toString() ?? "";
	const encryptedState = formData.get("state")?.toString() ?? "";
	const state = await decryptEncryptedAuthenticationCeremonyState(
		encryptedState,
		context.config.auth.security.keys.publicKey,
	);
	const subject = isAuthenticationCeremonyStateIdentified(state)
		? state.identity
		: context.remoteAddress;
	const result = await context.auth.submitIdentification(
		state,
		type,
		identification,
		subject,
	);
	if (result.done) {
		const session = await context.session.create(result.identityId, {});
		return { done: true, session: session.id };
	} else {
		return {
			...result,
			...("state" in result
				? {
					encryptedState: await encryptAuthenticationCeremonyState(
						result.state,
						context.config.auth.security.keys.algo,
						context.config.auth.security.keys.privateKey,
					),
				}
				: {}),
		};
	}
}

async function postSignInSubmitChallenge(
	request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	const formData = await request.formData();
	const type = formData.get("type")?.toString() ?? "";
	const challenge = formData.get("challenge")?.toString() ?? "";
	const encryptedState = formData.get("state")?.toString() ?? "";
	const state = await decryptEncryptedAuthenticationCeremonyState(
		encryptedState,
		context.config.auth.security.keys.publicKey,
	);
	assertAuthenticationCeremonyStateIdentified(state);
	const result = await context.auth.submitChallenge(
		state,
		type,
		challenge,
		state.identity,
	);
	if (result.done) {
		const session = await context.session.create(result.identityId, {});
		return result;
	} else {
		return {
			...result,
			...("state" in result
				? {
					state: await encryptAuthenticationCeremonyState(
						result.state,
						context.config.auth.security.keys.algo,
						context.config.auth.security.keys.privateKey,
					),
				}
				: {}),
		};
	}
}

async function postSendIdentificationValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	const formData = await request.formData();
	const type = formData.get("type")?.toString() ?? "";
	const identification = formData.get("identification")?.toString() ?? "";
	const identityIdentification = await context.identity.matchIdentification(
		type,
		identification,
	);
	await context.auth.sendIdentificationValidationCode(
		identityIdentification.identityId,
		type,
	);
	return { sent: true };
}

async function postConfirmIdentificationValidationCode(
	request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	const formData = await request.formData();
	const type = formData.get("type")?.toString() ?? "";
	const identification = formData.get("identification")?.toString() ?? "";
	const code = formData.get("code")?.toString() ?? "";
	const identityIdentification = await context.identity.matchIdentification(
		type,
		identification,
	);
	await context.auth.confirmIdentificationValidationCode(
		identityIdentification.identityId,
		type,
		code,
	);
	return { confirmed: true };
}

async function postSignOut(
	request: Request,
	_params: Record<never, never>,
	context: Context,
) {
	const formData = await request.formData();
	const session = formData.get("session")?.toString() ?? "";
	await context.session.destroy(session);
	return {};
}

const authRouter = new RouterBuilder<[context: Context]>();

authRouter.get("/flow", json(getFlowHandler));
authRouter.get("/signInStep", json(getSignInStep));
authRouter.post("/signInStep", json(postSignInStep));
authRouter.post(
	"/signInSubmitIdentification",
	json(postSignInSubmitIdentification),
);
authRouter.post("/signInSubmitChallenge", json(postSignInSubmitChallenge));
authRouter.post(
	"/sendIdentificationValidationCode",
	json(postSendIdentificationValidationCode),
);
authRouter.post(
	"/confirmIdentificationValidationCode",
	json(postConfirmIdentificationValidationCode),
);
authRouter.post("/signOut", json(postSignOut));

export default authRouter;
