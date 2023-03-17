import type { JWTPayload, KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import { getCookies, setCookie, deleteCookie } from "https://deno.land/std@0.179.0/http/mod.ts";
import { RouterBuilder } from "../router.ts";
import { Context } from "../context.ts";
import { createLogger } from "../logger.ts";
import { authStepIdent, AuthStepNextAtPath, getImmediateNextAuthStep, getNextAuthStepAtPath } from "./flow.ts";
import { AuthConfiguration } from "./config.ts";

const authRouter = new RouterBuilder<[context: Context]>();

const logger = createLogger("auth");

authRouter.get("/", () => new Response(null, { status: 301, headers: { Location: "/auth/login" } }));

authRouter.add(["GET", "POST"], "/login", async (request, _params, context) => {
	const cookies = getCookies(request.headers);
	const viewstate = await initViewState(cookies, context.config.auth);
	let nextStep: AuthStepNextAtPath;

	try {
		const result = getNextAuthStepAtPath(context.config.auth.authFlowDecomposed, viewstate.flow);
		if (result.done) {
			// TODO create session
			// TODO save cookie
			// TODO redirect
			return new Response(null, { status: 301, headers: { Location: "/auth/logged" } });
		} else {
			nextStep = result.next;
		}
	} catch (_err) {
		const headers = new Headers({ Location: "/auth/login?code=reached_invalid_flow" });
		destroyViewState(headers);
		logger.error(`Authentication flow reached invalid flow [${viewstate.flow}].`);
		return new Response(null, { status: 301, headers });
	}

	if (request.method === "POST") {
		let found = false;
		const formData = await request.formData().catch(() => new FormData());
		const stepIdent = formData.get("step")?.toString();
		for (const step of getImmediateNextAuthStep(nextStep)) {
			if (authStepIdent(step) === stepIdent) {
				found = true;
				// TODO perform step challenge
				logger.info(`Challenge ${authStepIdent(step)}...`);

				// Advance auth flow
				viewstate.flow.push(stepIdent);
				// Is flow done?
				const result = getNextAuthStepAtPath(context.config.auth.authFlowDecomposed, viewstate.flow);
				if (result.done) {
					const headers = new Headers({ Location: "/auth/logged" });
					destroyViewState(headers);
					// TODO create session
					// TODO save cookie
					// TODO redirect
					return new Response(null, { status: 301, headers });
				} else {
					nextStep = result.next;
				}
				break;
			}
		}
		if (!found) {
			const headers = new Headers({ Location: "/auth/login?code=reached_invalid_flow" });
			destroyViewState(headers);
			logger.error(`Authentication flow reached invalid flow [${viewstate.flow}].`);
			return new Response(null, { status: 301, headers });
		}
	}

	const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
	saveViewState(headers, viewstate, context.config.auth.authKeys.algo, context.config.auth.authKeys.privateKey);
	console.log(viewstate, headers.get('set-cookie'));

	// TODO present choice
	// return context.config.auth.views?.login(request, context.config.auth) ?? new Response(undefined, { status: 501 });
	// return new Response(`Present ${authStepIdent(nextStep)}`, { status: 501 });
	const body = context.config.auth.views?.login({ request, nextStep, context }) ?? "";
	return new Response(body, { status: 200, headers });
});

authRouter.get("/logout", () => new Response(null, { status: 501 }));
authRouter.post("/logout", () => new Response(null, { status: 501 }));

export interface ViewState {
	id?: string;
	flow: string[];
}

function assertsViewState(value?: unknown): asserts value is ViewState {
	if (!value || typeof value !== "object" || !("flow" in value) || !Array.isArray(value.flow) || value.flow.some((v) => typeof v !== "string")) {
		throw new Error(`Value is not a ViewState.`);
	}
}

async function deserializeViewState(data: string, publicKey: KeyLike): Promise<ViewState> {
	const { payload } = await jwtVerify(data, publicKey);
	assertsViewState(payload);
	return payload;
}

async function serializeViewState(viewstate: ViewState, alg: string, privateKey: KeyLike, expiration: string | number = "1m"): Promise<string> {
	assertsViewState(viewstate);
	return await new SignJWT(viewstate as unknown as JWTPayload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(expiration)
		.sign(privateKey);
}

async function initViewState(cookies: Record<string, string>, auth: AuthConfiguration): Promise<ViewState> {
	let viewstate: ViewState;
	try {
		viewstate = await deserializeViewState(cookies.viewstate?.toString() ?? "", auth.authKeys.publicKey);
	} catch (_err) {
		viewstate = { flow: [] };
	}
	return viewstate;
}

async function saveViewState(headers: Headers, viewstate: ViewState, alg: string, privateKey: KeyLike, expiration: string | number = "1m") {
	setCookie(headers, { name: 'viewstate', value: await serializeViewState(viewstate, alg, privateKey, expiration) })
}

function destroyViewState(headers: Headers) {
	deleteCookie(headers, 'viewstate');
}

export default authRouter;
