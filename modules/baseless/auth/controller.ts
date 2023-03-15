import { getCookies, setCookie } from "https://deno.land/std@0.179.0/http/mod.ts";
import { decode, encode } from "https://deno.land/std@0.179.0/encoding/base64.ts";

import { deserializeSession, serializeSession, Session } from "./session.ts";
import { Router } from "../router.ts";
import { Context } from "../context.ts";
import { authStepIdent, nextAuthStep } from "./flow.ts";
import { AuthConfiguration } from "./config.ts";

const authRouter = new Router<[context: Context]>();

async function initSession(request: Request, auth: AuthConfiguration): Promise<[headers: Headers, session: Session]> {
	const headers = new Headers();
	const cookies = getCookies(request.headers);
	let session: Session;
	try {
		session = await deserializeSession(cookies.session ?? "", auth.authKeys.publicKey);
	} catch (_err) {
		session = { flow: ['email'] };
		setCookie(headers, { name: 'session', value: await serializeSession(session, auth.authKeys.algo, auth.authKeys.privateKey) })
	}
	return [headers, session];
}

authRouter.get("/login", async (request, _params, context) => {
	const [headers, session] = await initSession(request, context.config.auth);

	try {
		const nextStep = nextAuthStep(context.config.auth.authFlowDecomposed, session.flow);
		if (!nextStep.done) {
			// TODO present step form
			// return context.config.auth.views?.login(request, context.config.auth) ?? new Response(undefined, { status: 501 });
			return new Response(`Next possible action : ${authStepIdent(nextStep.next)}`, { status: 501, headers });
		} else {
			// TODO redirect to final location?
			return new Response(null, { status: 501, headers });
		}
	} catch (_err) {
		// TODO session was in invalid state, present error
		return new Response(null, { status: 500, headers });
	}
});

authRouter.post("/login", async (request, _params, context) => {
	const [headers, session] = await initSession(request, context.config.auth);
	const post = await request.formData();

	// TODO decrypt viewstate from cookie
	// TODO determine next step
	// TODO perform step challenge
	// TODO advance step
	// TODO encrypt viewstate to cookie
	return new Response(null, { status: 301, headers });
});

export default authRouter;
