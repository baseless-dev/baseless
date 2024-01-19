import { Router } from "./router.ts";
import * as t from "../schema/types.ts";
import { assertObjectMatch } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { parseRST } from "./rst.ts";
import { getRouterCode } from "./compiled_router.ts";

Deno.test("route", async () => {
	const auth = new Router()
		.post(
			"/login",
			({ body }) => Response.json(body),
			{
				body: t.Object({ username: t.String(), password: t.String() }, [
					"username",
					"password",
				]),
			},
		);

	const app = new Router()
		.use(auth)
		.get("/", () => Response.json({ get: "/" }), {
			headers: t.Object({ "x-foo": t.String() }, ["x-foo"]),
		})
		.get(
			"/users/{id}",
			({ params }) => {
				return Response.json({ get: params.id });
			},
			{
				params: t.Object({ id: t.Describe("Le Id", t.String()) }, ["id"]),
			},
		)
		.get(
			"/users/{id}/comments/{comment}",
			({ params }) => {
				return Response.json({ get: params.comment });
			},
		)
		.post(
			"/users/{id}",
			({ params, body }) => {
				return Response.json({ patch: params.id, body: body });
			},
			{
				body: t.Object({
					username: t.String(),
					age: t.Number({ minimum: 14 }),
					displayName: t.String(),
				}, [
					"username",
				]),
			},
		);

	type result = keyof Awaited<ReturnType<typeof app.getFinalizedData>>[0];

	const router = await app.build();
	assertObjectMatch(
		await extractResponse(router(
			new Request("http://localhost:8080/", {
				method: "GET",
				headers: { "x-foo": "123" },
			}),
			{},
		)),
		{ body: '{"get":"/"}' },
	);
	assertObjectMatch(
		await extractResponse(router(
			new Request("http://localhost:8080/users/123", { method: "GET" }),
			{},
		)),
		{ body: '{"get":"123"}' },
	);
	assertObjectMatch(
		await extractResponse(router(
			new Request("http://localhost:8080/users/123", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ username: "foo" }),
			}),
			{},
		)),
		{ body: '{"patch":"123","body":{"username":"foo"}}' },
	);
	assertObjectMatch(
		await extractResponse(router(
			new Request("http://localhost:8080/login", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ username: "foo", password: "bar" }),
			}),
			{},
		)),
		{ body: '{"username":"foo","password":"bar"}' },
	);
});

Deno.test("compile", () => {
	{
		const rst = parseRST({
			"/": {
				GET: { handler: () => Response.error(), definition: {} },
			},
			"/{word}": {
				GET: {
					handler: () => Response.error(),
					definition: { headers: t.Object({ "x-foo": t.Number() }) },
				},
			},
			"/users/{id}/{comment}": {
				GET: { handler: () => Response.error(), definition: {} },
			},
			"/{...paths}": {
				GET: { handler: () => Response.error(), definition: {} },
			},
		});
		const { code } = getRouterCode(rst);
		console.log(code);
	}
});

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
