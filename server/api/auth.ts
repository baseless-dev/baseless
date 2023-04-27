import { RouterBuilder } from "../router.ts";
import { Context } from "../context.ts";
import type { JWTPayload, KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import { setCookie } from "https://deno.land/std@0.179.0/http/mod.ts";
import { AuthenticationState, assertAuthenticationState, assertAuthenticationStateIdentified, isAuthenticationStateIdentified } from "../auth/flow.ts";

const authRouter = new RouterBuilder<[context: Context]>();

async function decryptEncryptedAuthenticationState(data: string, publicKey: KeyLike): Promise<AuthenticationState> {
	try {
		const { payload } = await jwtVerify(data, publicKey);
		assertAuthenticationState(payload);
		return payload;
	} catch (_error) {
		return { choices: [] }
	}
}

async function encryptAuthenticationState(state: AuthenticationState, alg: string, privateKey: KeyLike, expiration: string | number = "10m"): Promise<string> {
	return await new SignJWT(state as unknown as JWTPayload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(expiration)
		.sign(privateKey);
}

authRouter.get("/flow", async (_request, _params, context) => {
	let status = 200;
	let json: Record<string, unknown> = {};
	try {
		json = await context.auth.getStep();
	} catch (error) {
		status = 500;
		json = { error: error.constructor.name };
	}
	return new Response(JSON.stringify(json), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
});

authRouter.post("/flow", async (request, _params, context) => {
	let status = 200;
	let json: Record<string, unknown> = {};
	try {
		const formData = await request.formData();
		const encryptedState = formData.get("state")?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationState(encryptedState, context.config.auth.security.keys.publicKey);
		json = await context.auth.getStep(state, context);
	} catch (error) {
		status = 500;
		json = { error: error.constructor.name }
	}
	return new Response(JSON.stringify(json), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
});

authRouter.post("/submitIdentification", async (request, _params, context) => {
	let status = 200;
	let json: Record<string, unknown> = {};
	const headers = new Headers();
	headers.set("Content-Type", "application/json");
	try {
		const formData = await request.formData();
		const type = formData.get("type")?.toString() ?? "";
		const identification = formData.get("identification")?.toString() ?? "";
		const encryptedState = formData.get("state")?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationState(encryptedState, context.config.auth.security.keys.publicKey);
		const subject = isAuthenticationStateIdentified(state) ? state.identity : request.headers.get("X-Real-Ip") ?? "";
		const result = await context.auth.submitIdentification(state, type, identification, subject);
		if (result.done) {
			const session = await context.session.create(result.identityId, {});
			// TODO cookie settings
			setCookie(headers, { name: "session", value: session.id, httpOnly: true, secure: false });
			json = { done: true };
		} else {
			json = {
				...result,
				...("state" in result ? { state: await encryptAuthenticationState(result.state, context.config.auth.security.keys.algo, context.config.auth.security.keys.privateKey) } : {}),
			};
		}
	} catch (error) {
		status = 500;
		json = { error: error.constructor.name }
	}
	return new Response(JSON.stringify(json), {
		status,
		headers
	});
});

authRouter.post("/submitChallenge", async (request, _params, context) => {
	let status = 200;
	let json: Record<string, unknown> = {};
	const headers = new Headers();
	headers.set("Content-Type", "application/json");
	try {
		const formData = await request.formData();
		const type = formData.get("type")?.toString() ?? "";
		const challenge = formData.get("challenge")?.toString() ?? "";
		const encryptedState = formData.get("state")?.toString() ?? "";
		const state = await decryptEncryptedAuthenticationState(encryptedState, context.config.auth.security.keys.publicKey);
		assertAuthenticationStateIdentified(state);
		const result = await context.auth.submitChallenge(state, type, challenge, state.identity);
		if (result.done) {
			const session = await context.session.create(result.identityId, {});
			// TODO cookie settings
			setCookie(headers, { name: "session", value: session.id, httpOnly: true, secure: false });
			json = { done: true, session };
		} else {
			json = {
				...result,
				...("state" in result ? { state: await encryptAuthenticationState(result.state, context.config.auth.security.keys.algo, context.config.auth.security.keys.privateKey) } : {}),
			};
		}
	} catch (error) {
		status = 500;
		json = { error: error.constructor.name };
	}
	return new Response(JSON.stringify(json), {
		status,
		headers
	});
});

export default authRouter;
