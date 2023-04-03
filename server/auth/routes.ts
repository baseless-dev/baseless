import type { JWTPayload, KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { SignJWT } from "https://deno.land/x/jose@v4.13.1/jwt/sign.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.13.1/jwt/verify.ts";
import { deleteCookie, getCookies, setCookie } from "https://deno.land/std@0.179.0/http/mod.ts";
import { RouterBuilder } from "../router.ts";
import { Context } from "../context.ts";
import { createLogger } from "../logger.ts";
import { authStepIdent, AuthStepNext, getImmediateNextAuthStep, getNextAuthStepAtPath } from "./flow.ts";
import { AuthConfiguration } from "./config.ts";

const authRouter = new RouterBuilder<[context: Context]>();

const logger = createLogger("baseless-auth");

authRouter.get("/", () => new Response(null, { status: 301, headers: { Location: "/auth/login" } }));

async function getViewStateAndNextStep(request: Request, auth: AuthConfiguration): Promise<[viewstate: ViewState, next: AuthStepNext]> {
	const viewstate = await initViewState(request, auth);
	const nextStep = getNextAuthStepAtPath(auth.authFlowDecomposed, viewstate.flow);
	return [viewstate, nextStep];
}

authRouter.get("/", (request, _params, context) => {
	// TODO validate session
	const headers = new Headers();
	headers.set("Content-Type", "text/html; charset=utf-8");
	return new Response(context.config.auth.views?.loggedin({ request, context }), { status: 200, headers });
});

authRouter.add(["GET", "POST"], "/login", async (request, _params, context) => {
	// TODO No caching everywhere?
	let viewstate: ViewState;
	let nextStep: AuthStepNext;
	try {
		[viewstate, nextStep] = await getViewStateAndNextStep(request, context.config.auth);
	} catch (_err) {
		const headers = new Headers();
		destroyViewState(headers);
		headers.set("Location", "./login?code=reached_invalid_flow");
		logger.error(`Authentication flow reached invalid flow.`);
		return new Response(null, { status: 301, headers });
	}

	if (nextStep.done) {
		// TODO redirect
		const headers = new Headers({ Location: "/auth/" });
		destroyViewState(headers);
		// TODO create session
		// TODO save cookie
		return new Response(null, { status: 301, headers });
	}

	const headers = new Headers();
	const url = new URL(request.url);

	const action = url.searchParams.get("action")?.toLowerCase() ?? undefined;
	try {
		const possibleActions = Array.from(getImmediateNextAuthStep(nextStep.next)).map(authStepIdent);
		// TODO remove from possible action unsetuped
		const isFirstStep = viewstate.flow.length === 0;
		let isLastStep = false;
		if (!action) {
			if (request.method === "GET") {
				if (possibleActions.length === 1) {
					headers.set("Location", `./login?action=${possibleActions.at(0)}`);
					return new Response(null, { status: 301, headers });
				} else {
					headers.set("Content-Type", "text/html; charset=utf-8");
					return new Response(context.config.auth.views?.login({ request, steps: nextStep.next, isFirstStep, isLastStep, context }), { status: 200, headers });
				}
			} else {
				headers.set("Location", "./login");
				const formData = await request.formData();
				if (formData.get("action")?.toString() === "back") {
					viewstate.flow.pop();
					await saveViewState(headers, viewstate, context.config.auth.authKeys.algo, context.config.auth.authKeys.privateKey);
				}
				return new Response(null, { status: 301, headers });
			}
		} else if (action === "reset") {
			const headers = new Headers({ Location: "./login" });
			destroyViewState(headers);
			return new Response(null, { status: 301, headers });
		} else {
			if (possibleActions.includes(action)) {
				isLastStep = getNextAuthStepAtPath(context.config.auth.authFlowDecomposed, [...viewstate.flow, action]).done;
				if (request.method === "GET") {
					headers.set("Content-Type", "text/html; charset=utf-8");
					if (action === "email") {
						return new Response(context.config.auth.views?.promptEmail({ request, steps: nextStep.next, isFirstStep, isLastStep, context }), { status: 200, headers });
					} else if (action === "password") {
						return new Response(context.config.auth.views?.promptPassword({ request, steps: nextStep.next, isFirstStep, isLastStep, context }), { status: 200, headers });
					}
				} else {
					let redirect = "./login";
					let dirtyViewState = false;
					const formData = await request.formData();
					if (formData.get("action")?.toString() === "back") {
						if (possibleActions.length === 1) {
							viewstate.flow.pop();
							dirtyViewState = true;
						}
					} else if (action === "email") {
						const email = formData.get("email");
						if (email) {
							try {
								const identity = await context.identity.getIdentityByStepIdentifier("email", email.toString());
								logger.log(`Authentication step email:${email} success.`);
								viewstate.id = identity;
								viewstate.flow.push("email");
								dirtyViewState = true;
							} catch (_inner) {
								logger.info(`Authentication step email:${email} failed.`);
								redirect = "./login?action=email&code=invalid_email";
							}
						} else {
							logger.info(`Authentication step email:**not provided** failed.`);
							redirect = "./login?action=email&code=invalid_email";
						}
					} else if (action === "password" && viewstate.id) {
						const password = formData.get("password");
						if (password) {
							try {
								const passwordMatch = await context.identity.testStepChallenge(viewstate.id, "password", password.toString());
								if (passwordMatch) {
									logger.log(`Authentication step password:******** success.`);
									viewstate.flow.push("password");
									dirtyViewState = true;
								} else {
									logger.info(`Authentication step password:******** failed.`);
									redirect = "./login?action=password&code=invalid_password";
								}
							} catch (_inner) {
								logger.info(`Authentication step password:******** failed.`);
								redirect = "./login?action=password&code=invalid_password";
							}
						} else {
							logger.info(`Authentication step password:******** failed.`);
							redirect = "./login?action=password&code=invalid_password";
						}
					}
					headers.set("Location", redirect);
					if (dirtyViewState) {
						await saveViewState(headers, viewstate, context.config.auth.authKeys.algo, context.config.auth.authKeys.privateKey);
					}
					return new Response(null, { status: 301, headers });
				}
				return new Response(null, { status: 501, headers });
			}
			headers.set("Location", "./login?code=invalid_action");
			return new Response(null, { status: 301, headers });
		}
	} catch (err) {
		logger.error(err.toString());
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

async function serializeViewState(viewstate: ViewState, alg: string, privateKey: KeyLike, expiration: string | number = "1m"): Promise<string> {
	assertsViewState(viewstate);
	return await new SignJWT(viewstate as unknown as JWTPayload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(expiration)
		.sign(privateKey);
}

async function initViewState(request: Request, auth: AuthConfiguration): Promise<ViewState> {
	const cookies = getCookies(request.headers);
	let viewstate: ViewState;
	try {
		viewstate = await deserializeViewState(cookies.viewstate?.toString() ?? "", auth.authKeys.publicKey);
	} catch (_err) {
		viewstate = { flow: [] };
	}
	return viewstate;
}

async function saveViewState(headers: Headers, viewstate: ViewState, alg: string, privateKey: KeyLike, expiration: string | number = "1m") {
	const serialized = await serializeViewState(viewstate, alg, privateKey, expiration);
	setCookie(headers, { name: "viewstate", value: serialized });
}

function destroyViewState(headers: Headers) {
	deleteCookie(headers, "viewstate");
}

export default authRouter;
