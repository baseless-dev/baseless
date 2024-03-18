import { assertObjectMatch } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { t as tb } from "../typebox.ts";
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

Deno.test("route", async (t) => {
	await t.step("simple", async () => {
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
					body: tb.Object({
						username: tb.String(),
						age: tb.Optional(tb.Number({ minimum: 14 })),
						displayName: tb.Optional(tb.String()),
					}),
				},
			)
			.build(false);

		assertObjectMatch(
			await extractResponse(handle(new Request("https://testb.local/foo"))),
			{ body: `"foo"` },
		);
		assertObjectMatch(
			await extractResponse(
				handle(new Request("https://testb.local/foo", { method: "POST" })),
			),
			{ body: `"bar"` },
		);
		assertObjectMatch(
			await extractResponse(
				handle(new Request("https://testb.local/users/123")),
			),
			{ body: `{"get":"123"}` },
		);
		assertObjectMatch(
			await extractResponse(
				handle(
					new Request("https://testb.local/users/123", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ username: "foo" }),
					}),
				),
			),
			{ body: `{"params":{"id":"123"},"body":{"username":"foo"}}` },
		);
	});

	await t.step("proxy", async () => {
		const foo = new Application()
			.get("/", () => new Response("foo"))
			.get("/foo", () => new Response("foofoo"));
		const app = new Application()
			.proxy("/api", foo, () => {
				return new Response("proxy");
			})
			.get("/", () => new Response("app"));
		const handle = await app.build(false);

		assertObjectMatch(
			await extractResponse(
				handle(
					new Request("https://testb.local/"),
				),
			),
			{ body: `app` },
		);
		assertObjectMatch(
			await extractResponse(
				handle(
					new Request("https://testb.local/api/"),
				),
			),
			{ body: `proxy` },
		);
		assertObjectMatch(
			await extractResponse(
				handle(
					new Request("https://testb.local/api/foo"),
				),
			),
			{ body: `proxy` },
		);
		assertObjectMatch(
			await extractResponse(
				handle(
					new Request("https://testb.local/api/bar"),
				),
			),
			{ status: 404 },
		);
	});
});
