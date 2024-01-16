import { c, router, t } from "../../server/server.ts";
import auth from "../../server/auth.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { autoid } from "../../common/system/autoid.ts";
import openapi from "../../server/openapi.ts";

const { publicKey, privateKey } = await generateKeyPair("PS512");

const app = router()
	.use(
		"/auth",
		auth({
			keys: { publicKey, privateKey, algo: "PS512" },
			salt: autoid() as string,
			ceremonyComponent: c.sequence(),
		}),
	)
	.use(openapi({
		title: "Hello World Documentation",
		version: "0.0.0-0",
	}, {
		tags: ["Debug"],
	}))
	.get(
		"/hello/{world}",
		({ params, query }) =>
			new Response(
				`Hello, ${decodeURIComponent(params.world)}${query.exclamation ?? "!"}`,
			),
		{
			summary: "Hello World",
			description: "Says hello to the world.",
			params: t.Object(
				{ world: t.Describe("The placeholder", t.String()) },
				["world"],
			),
			query: t.Object(
				{
					exclamation: t.Referenceable(
						"ExclamationMark",
						t.Describe("The exclamation mark", t.String()),
					),
				},
			),
			response: {
				200: {
					description: "La salutation",
					content: {
						"text/plain": {
							schema: t.Describe("La salutation", t.String()),
						},
					},
				},
			},
		},
	);

const handle = await app.build();

const abortController = new AbortController();

Deno.addSignalListener("SIGTERM", () => {
	abortController.abort();
});

await Deno.serve({
	port: 8081,
	hostname: "localhost",
	signal: abortController.signal,
}, async (req, info) => {
	const res = await handle(req);
	res.headers.set(
		"Access-Control-Allow-Origin",
		req.headers.get("Origin") ?? "*",
	);
	return res;
});
