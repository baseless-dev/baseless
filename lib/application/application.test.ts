import { assertObjectMatch } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { t } from "../typebox.ts";
import { Application } from "./application.ts";

async function extractResponse(
	handler: Promise<Response>,
): Promise<{
	status: number;
	headers: Record<string, string>;
	body: string;
}> {
	const r = await handler;
	return {
		status: r.status,
		headers: Object.fromEntries(r.headers),
		body: await r.text(),
	};
}

Deno.test("route", async () => {
	const handle = await new Application()
		.get(
			"/foo",
			(_) => Response.json("foo"),
		)
		.post(
			"/foo",
			(_) => Response.json("bar"),
		)
		.get(
			"/users/{id}",
			({ params }) => {
				return Response.json({ get: params.id });
			},
		)
		.post(
			"/users/{id}",
			({ params, body }) => {
				return Response.json({ params, body });
			},
			{
				body: t.Object({
					username: t.String(),
					age: t.Optional(t.Number({ minimum: 14 })),
					displayName: t.Optional(t.String()),
				}),
			},
		)
		.build(false);

	assertObjectMatch(
		await extractResponse(handle(new Request("https://test.local/foo"))),
		{ body: `"foo"` },
	);
	assertObjectMatch(
		await extractResponse(
			handle(new Request("https://test.local/foo", { method: "POST" })),
		),
		{ body: `"bar"` },
	);
	assertObjectMatch(
		await extractResponse(handle(new Request("https://test.local/users/123"))),
		{ body: `{"get":"123"}` },
	);
	assertObjectMatch(
		await extractResponse(
			handle(
				new Request("https://test.local/users/123", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ username: "foo" }),
				}),
			),
		),
		{ body: `{"params":{"id":"123"},"body":{"username":"foo"}}` },
	);
});
