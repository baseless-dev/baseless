import type { JWTPayload, KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import { deleteCookie, getCookies, setCookie } from "https://deno.land/std@0.179.0/http/mod.ts";
import { RouterBuilder } from "../router.ts";
import { Context } from "../context.ts";
import { createLogger } from "../logger.ts";
import {
	AuthenticationChallenge,
	AuthenticationChoice,
	AuthenticationIdentification,
	AuthenticationSequence,
	getNextAuthenticationStepAtPath,
	getNextIdentificationOrChallenge,
	NextAuthenticationStepResult,
} from "./flow.ts";
import { AuthenticationConfiguration } from "./config.ts";

const authRouter = new RouterBuilder<[context: Context]>();

const logger = createLogger("baseless-auth");

async function getViewStateAndNextStep(request: Request, auth: AuthenticationConfiguration): Promise<[viewstate: ViewState, next: NextAuthenticationStepResult]> {
	const viewstate = await initViewState(request, auth);
	const next = getNextAuthenticationStepAtPath(auth.flattenedFlow, viewstate.flow);
	return [viewstate, next];
}

authRouter.get("/", (request, _params, context) => {
	// TODO validate session
	const headers = new Headers({ "Cache-Control": "no-cache", "Content-Type": "text/html; charset=utf-8" });
	return new Response(context.config.auth.views?.index(request, context), { status: 200, headers });
});

authRouter.add(["GET", "POST"], "/login/:action?", async (request, params, context) => {
	const headers = new Headers({ "Cache-Control": "no-cache" });
	let viewstate: ViewState;
	let nextResult: NextAuthenticationStepResult;
	try {
		[viewstate, nextResult] = await getViewStateAndNextStep(request, context.config.auth);
	} catch (_err) {
		destroyViewState(headers);
		headers.set("Location", "/auth/login?code=invalid_flow");
		logger.error(`Authentication flow reached invalid flow.`);
		return new Response(null, { status: 301, headers });
	}

	if (nextResult.done) {
		// TODO redirect
		headers.set("Location", `/auth/`);
		destroyViewState(headers);
		// TODO create session
		// TODO save cookie
		return new Response(null, { status: 301, headers });
	}

	const action = params.action?.toLowerCase();
	const possibleSteps = Array.from(getNextIdentificationOrChallenge(nextResult.next));

	// TODO back action?

	const step = action ? possibleSteps.find((step) => step.id === action) : nextResult.next;
	const isFirstStep = viewstate.flow.length === 0;

	if (!step) {
		headers.set("Location", `/auth/login?code=invalid_action`);
		return new Response(null, { status: 301, headers });
	} else if (step instanceof AuthenticationChoice) {
		headers.set("Content-Type", "text/html; charset=utf-8");
		return new Response(context.config.auth.views?.promptChoice({ request, step, isFirstStep, isLastStep: false, context }), { status: 200, headers });
	} else if (!(step instanceof AuthenticationSequence)) {
		if (!action) {
			headers.set("Location", `/auth/login/${step.id}`);
			return new Response(null, { status: 301, headers });
		}
		const isLastStep = getNextAuthenticationStepAtPath(context.config.auth.flattenedFlow, [...viewstate.flow, action]).done;
		if (request.method === "GET") {
			if (viewstate.id && step instanceof AuthenticationChallenge && step.send) {
				const counterInterval = step.sendInterval * 1000;
				const slidingWindow = Math.round(Date.now() / counterInterval);
				const counterKey = `/auth/challenge/${viewstate.id}/${step.id}/${slidingWindow}`;
				if (await context.counter.increment(counterKey, 1, counterInterval) > step.sendLimit) {
					logger.warn(`Authentication challenge ${step.id} for ${viewstate.id} rate limited.`);
					headers.set("Retry-After", step.sendInterval.toString());
					headers.set("Content-Type", "text/html; charset=utf-8");
					return new Response(context.config.auth.views?.rateLimited(request, context), { status: 429, headers });
				}
				await step.send(request, context, viewstate.id);
			}
			if (step.prompt === "email") {
				headers.set("Content-Type", "text/html; charset=utf-8");
				return new Response(context.config.auth.views?.promptEmail({ request, step, isFirstStep, isLastStep, context }), { status: 200, headers });
			} else if (step.prompt === "password") {
				headers.set("Content-Type", "text/html; charset=utf-8");
				return new Response(context.config.auth.views?.promptPassword({ request, step, isFirstStep, isLastStep, context }), { status: 200, headers });
			} else if (step.prompt === "otp") {
				headers.set("Content-Type", "text/html; charset=utf-8");
				return new Response(context.config.auth.views?.promptOTP({ request, step, isFirstStep, isLastStep, context }), { status: 200, headers });
			} else if (step.prompt === "action") {
				return new Response(null, { status: 501, headers });
			}
		} else {
			const ip = request.headers.get("X-Real-Ip") ?? "";
			if (step instanceof AuthenticationIdentification) {
				const counterInterval = context.config.auth.rateLimitIdentificationInterval * 1000;
				const slidingWindow = Math.round(Date.now() / counterInterval);
				const counterKey = `/auth/ident/${ip}/${slidingWindow}`;
				if (await context.counter.increment(counterKey, 1, counterInterval) > context.config.auth.rateLimitIdentificationCount) {
					logger.warn(`Authentication challenge ${step.id} for ${ip} rate limited.`);
					headers.set("Retry-After", context.config.auth.rateLimitIdentificationInterval.toString());
					headers.set("Content-Type", "text/html; charset=utf-8");
					return new Response(context.config.auth.views?.rateLimited(request, context), { status: 429, headers });
				}
				const result = await step.identify(request, context);
				if (result instanceof Response) {
					return result;
				}
				if (result && !viewstate.id || viewstate.id === result) {
					logger.log(`Authentication identification ${step.id} success.`);
					viewstate.id = result;
					viewstate.flow.push(step.id);
					headers.set("Location", "/auth/login");
					await saveViewState(headers, viewstate, context.config.auth.keys.algo, context.config.auth.keys.privateKey);
					return new Response(null, { status: 301, headers });
				} else {
					logger.info(`Authentication identification ${step.id} failed.`);
					headers.set("Location", `/auth/login/${action}?code=failed`);
					return new Response(null, { status: 301, headers });
				}
			} else {
				if (viewstate.id) {
					const counterInterval = context.config.auth.rateLimitChallengeInterval * 1000;
					const slidingWindow = Math.round(Date.now() / counterInterval);
					const counterKey = `/auth/challenge/${viewstate.id}/${slidingWindow}`;
					if (await context.counter.increment(counterKey, 1, counterInterval) > context.config.auth.rateLimitChallengeCount) {
						logger.warn(`Authentication challenge ${step.id} for ${viewstate.id} rate limited.`);
						headers.set("Retry-After", context.config.auth.rateLimitChallengeInterval.toString());
						headers.set("Content-Type", "text/html; charset=utf-8");
						return new Response(context.config.auth.views?.rateLimited(request, context), { status: 429, headers });
					}

					const result = await step.challenge(request, context, viewstate.id);
					if (result instanceof Response) {
						return result;
					}
					if (result) {
						logger.log(`Authentication challenge ${step.id} success.`);
						viewstate.flow.push(step.id);
						headers.set("Location", "/auth/login");
						await saveViewState(headers, viewstate, context.config.auth.keys.algo, context.config.auth.keys.privateKey);
						return new Response(null, { status: 301, headers });
					} else {
						logger.info(`Authentication challenge ${step.id} failed.`);
						headers.set("Location", `/auth/login/${action}?code=failed`);
						return new Response(null, { status: 301, headers });
					}
				}
			}
		}
	}
	logger.critical(`Authentication views did not produce any output.`);
	return new Response(null, { status: 500, headers });
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

async function serializeViewState(viewstate: ViewState, alg: string, privateKey: KeyLike, expiration: string | number = "10m"): Promise<string> {
	assertsViewState(viewstate);
	return await new SignJWT(viewstate as unknown as JWTPayload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(expiration)
		.sign(privateKey);
}

async function initViewState(request: Request, auth: AuthenticationConfiguration): Promise<ViewState> {
	const cookies = getCookies(request.headers);
	let viewstate: ViewState;
	try {
		viewstate = await deserializeViewState(cookies.viewstate?.toString() ?? "", auth.keys.publicKey);
	} catch (_err) {
		viewstate = { flow: [] };
	}
	return viewstate;
}

async function saveViewState(headers: Headers, viewstate: ViewState, alg: string, privateKey: KeyLike, expiration: string | number = "10m") {
	const serialized = await serializeViewState(viewstate, alg, privateKey, expiration);
	setCookie(headers, { name: "viewstate", value: serialized });
}

function destroyViewState(headers: Headers) {
	deleteCookie(headers, "viewstate");
}

export default authRouter;
