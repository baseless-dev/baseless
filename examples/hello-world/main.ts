import baseless, { BaselessContext, c, t } from "../../server/baseless.ts";
import auth from "../../server/auth.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.13.1/key/generate_key_pair.ts";
import { autoid } from "../../common/system/autoid.ts";
import openapi from "../../server/openapi.ts";

const { publicKey, privateKey } = await generateKeyPair("PS512");

const app = baseless()
	.get(
		"/hello/{world}",
		(_req, { params, query }) =>
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
	)
	// .use(
	// 	"/api/v1/auth",
	// 	auth({
	// 		keys: { publicKey, privateKey, algo: "PS512" },
	// 		salt: autoid() as string,
	// 		ceremonyComponent: c.sequence(),
	// 	}),
	// )
	.use(openapi({
		title: "Hello World Documentation",
		version: "0.0.0-0",
	}));

const handle = await app.build();

type routes = keyof Awaited<ReturnType<typeof app.getRoutes>>;

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
