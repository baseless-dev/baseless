import openapiPlugin from "../../plugins/openapi/mod.ts";
import mock from "../../server/mock.ts";
import { t } from "../../server/mod.ts";

const { router } = await mock();
router.use(openapiPlugin({
	title: "Hello World Documentation",
	version: "0.0.1",
}, {
	tags: ["Debug"],
}));
router.get(
	"/api/v1/hello/{world}",
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

const handle = await router.build();

const abortController = new AbortController();
Deno.addSignalListener("SIGTERM", () => {
	abortController.abort();
});

await Deno.serve({
	port: 8081,
	hostname: "localhost",
	signal: abortController.signal,
}, async (req, info) => {
	const waitUntil: PromiseLike<void>[] = [];
	const res = await handle(req, { waitUntil });
	res.headers.set(
		"Access-Control-Allow-Origin",
		req.headers.get("Origin") ?? "*",
	);
	return res;
});
