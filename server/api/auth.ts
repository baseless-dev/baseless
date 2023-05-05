import { RouterBuilder } from "../router.ts";
import { Context } from "../context.ts";
import type {
	JWTPayload,
	KeyLike,
} from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import {
	assertAuthenticationState,
	assertAuthenticationStateIdentified,
	AuthenticationState,
	isAuthenticationStateIdentified,
} from "../auth/flow.ts";
import {
	assertAuthenticationResultState,
	AuthenticationConfirmValidationCodeError,
	AuthenticationSendValidationCodeError,
} from "../services/auth.ts";

const authRouter = new RouterBuilder<[context: Context]>();

async function decryptEncryptedAuthenticationState(
	data: string,
	publicKey: KeyLike,
): Promise<AuthenticationState> {
	try {
		const { payload } = await jwtVerify(data, publicKey);
		assertAuthenticationState(payload);
		return payload;
	} catch (_error) {
		return { choices: [] };
	}
}

async function encryptAuthenticationState(
	state: AuthenticationState,
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

function json(
	value: Record<string, unknown>,
	status = 200,
	headers = new Headers(),
): Response {
	headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
	headers.set("Content-Type", "application/json");
	return new Response(JSON.stringify(value), {
		status,
		headers,
	});
}

authRouter.get("/flow", async (_request, _params, context) => {
	return json(await context.config.auth.flow.step, 200);
});

authRouter.get("/signInStep", async (_request, _params, context) => {
	try {
		return json(await context.auth.getStep(), 200);
	} catch (error) {
		return json({ error: error.constructor.name }, 400);
	}
});

authRouter.post("/signInStep", async (request, _params, context) => {
	try {
		const formData = await request.formData();
		const encryptedState = formData.get("state")?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationState(
			encryptedState,
			context.config.auth.security.keys.publicKey,
		);
		return json(await context.auth.getStep(state, context), 200);
	} catch (error) {
		return json({ error: error.constructor.name }, 400);
	}
});

authRouter.post(
	"/signInSubmitIdentification",
	async (request, _params, context) => {
		try {
			const formData = await request.formData();
			const type = formData.get("type")?.toString() ?? "";
			const identification = formData.get("identification")?.toString() ?? "";
			const encryptedState = formData.get("state")?.toString() ?? "";
			const state = await decryptEncryptedAuthenticationState(
				encryptedState,
				context.config.auth.security.keys.publicKey,
			);
			const subject = isAuthenticationStateIdentified(state)
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
				return json({ done: true, session: session.id }, 200);
			} else {
				return json({
					...result,
					...("state" in result
						? {
							encryptedState: await encryptAuthenticationState(
								result.state,
								context.config.auth.security.keys.algo,
								context.config.auth.security.keys.privateKey,
							),
						}
						: {}),
				}, 200);
			}
		} catch (error) {
			return json({ error: error.constructor.name }, 400);
		}
	},
);

authRouter.post("/signInSubmitChallenge", async (request, _params, context) => {
	try {
		const formData = await request.formData();
		const type = formData.get("type")?.toString() ?? "";
		const challenge = formData.get("challenge")?.toString() ?? "";
		const encryptedState = formData.get("state")?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationState(
			encryptedState,
			context.config.auth.security.keys.publicKey,
		);
		assertAuthenticationStateIdentified(state);
		const result = await context.auth.submitChallenge(
			state,
			type,
			challenge,
			state.identity,
		);
		if (result.done) {
			const session = await context.session.create(result.identityId, {});
			return json(result, 200);
		} else {
			return json({
				...result,
				...("state" in result
					? {
						state: await encryptAuthenticationState(
							result.state,
							context.config.auth.security.keys.algo,
							context.config.auth.security.keys.privateKey,
						),
					}
					: {}),
			}, 200);
		}
	} catch (error) {
		return json({ error: error.constructor.name }, 400);
	}
});

authRouter.post(
	"/sendIdentificationValidationCode",
	async (request, _params, context) => {
		try {
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
			return json({ sent: true }, 200);
		} catch (_error) {
			return json({ error: AuthenticationSendValidationCodeError.name }, 400);
		}
	},
);

authRouter.post(
	"/confirmIdentificationValidationCode",
	async (request, _params, context) => {
		try {
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
			return json({ confirmed: true }, 200);
		} catch (_error) {
			return json(
				{ error: AuthenticationConfirmValidationCodeError.name },
				400,
			);
		}
	},
);

authRouter.post("/signOut", async (request, _params, context) => {
	try {
		const formData = await request.formData();
		const session = formData.get("session")?.toString() ?? "";
		await context.session.destroy(session);
	} finally {
		// ignore
	}
	return json({}, 200);
});

export default authRouter;
