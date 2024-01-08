import baseless, { BaselessContext, c, t } from "../../server/baseless.ts";
import auth from "../../server/auth.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { autoid } from "../../common/system/autoid.ts";
import openapi from "../../server/openapi.ts";

const { publicKey, privateKey } = await generateKeyPair("PS512");

const app = baseless()
	.get(
		"/:world",
		(_req, { params }) =>
			new Response(`Hello, ${decodeURIComponent(params.world)}!`),
		{
			summary: "Hello World",
			description: "Says hello to the world.",
			response: {
				200: t.String(),
			},
		},
	)
	.use(auth({
		keys: { publicKey, privateKey, algo: "PS512" },
		salt: autoid() as string,
		ceremonyComponent: c.sequence(),
	}))
	.use(openapi({
		title: "Hello World Documentation",
		version: "0.0.0-0",
	}));

const handle = app.build();

const abortController = new AbortController();

Deno.addSignalListener("SIGTERM", () => {
	abortController.abort();
});

await Deno.serve({
	port: 8081,
	hostname: "localhost",
	signal: abortController.signal,
}, async (req, info) => {
	const res = await handle(req, {} as BaselessContext);
	res.headers.set("Access-Control-Allow-Origin", "*");
	return res;
});
