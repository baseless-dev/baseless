import { getCookies } from "https://deno.land/std@0.179.0/http/mod.ts";
import { decode, encode } from "https://deno.land/std@0.179.0/encoding/base64.ts";
import { CompactSign } from "https://deno.land/x/jose@v4.13.1/jws/compact/sign.ts";
import { compactVerify } from "https://deno.land/x/jose@v4.13.1/jws/compact/verify.ts";
import { Router } from "../router.ts";
import { Context } from "../context.ts";

const authRouter = new Router<[context: Context]>();

interface ViewState {
}

authRouter.get("/login", async (request, _params, context) => {
	// const encryptedData = await crypto.subtle.encrypt(context.config.auth.authKeys.algo, context.config.auth.authKeys.publicKey, new TextEncoder().encode("foobar"));
	// const encryptedB64 = encode(encryptedData);
	// console.log(encryptedB64);
	// const decryptedB64 = decode(encryptedB64);
	// const decryptedData = await crypto.subtle.decrypt(context.config.auth.authKeys.algo, context.config.auth.authKeys.privateKey, decryptedB64);
	// console.log(new TextDecoder().decode(decryptedData));

	// const jwe = await new CompactEncrypt(new TextEncoder().encode("foobar")).setProtectedHeader({ alg: context.config.auth.authKeys.algo }).encrypt(context.config.auth.authKeys.publicKey);
	// console.log(jwe);

	const jws = await new CompactSign(new TextEncoder().encode("foobar")).setProtectedHeader({ alg: context.config.auth.authKeys.algo }).sign(
		context.config.auth.authKeys.privateKey,
	);
	console.log(jws);
	const { payload } = await compactVerify(jws, context.config.auth.authKeys.publicKey);
	console.log(new TextDecoder().decode(payload));

	// const viewstateEncrypted = getCookies(request.headers)['viewstate'];
	// TODO decrypt viewstate from cookie
	// TODO determine next step
	// TODO present step form
	// return context.config.auth.views?.login(request, context.config.auth) ?? new Response(undefined, { status: 501 });
	return new Response(null, { status: 501 });
});

authRouter.post("/login", async (request, _params, _context) => {
	const post = await request.formData();

	// TODO decrypt viewstate from cookie
	// TODO determine next step
	// TODO perform step challenge
	// TODO advance step
	// TODO encrypt viewstate to cookie
	return new Response(null, { status: 301 });
});

export default authRouter;
