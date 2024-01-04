import { Builder } from "./builder.ts";
import * as t from "../schema/types.ts";
import { assertObjectMatch } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { parseRST } from "./rst.ts";
import { getRouterCode } from "./compiled_router.ts";

const auth = new Builder()
	.post(
		"/login",
		(_req, ctx) => Response.json(ctx.body),
		{
			body: t.Object({ username: t.String(), password: t.String() }, [
				"username",
				"password",
			]),
		},
	);

const app = new Builder()
	.get(
		"/users/:id",
		(_req, ctx) => {
			return Response.json({ get: ctx.params.id });
		},
	)
	.get(
		"/users/:id/comments/:comment",
		(_req, ctx) => {
			return Response.json({ get: ctx.params.comment });
		},
	)
	.post(
		"/users/:id",
		(_req, ctx) => {
			return Response.json({ patch: ctx.params.id, body: ctx.body });
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
	)
	.use(auth);
const router = app.build();

Deno.test("route", async () => {
	assertObjectMatch(
		await extractResponse(router(
			new Request("http://localhost:8080/users/123", { method: "GET" }),
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
		)),
		{ body: '{"username":"foo","password":"bar"}' },
	);
});

Deno.test("compile", () => {
	{
		const rst = parseRST({
			"/users/:id/comments/:comment?": {
				GET: { handler: () => Response.error(), schemas: {} },
			},
		});
		const { code } = getRouterCode(rst);
		// console.log(code);
		debugger;
	}
});

async function extractResponse(
	handler: Promise<[Response, PromiseLike<any>[]]>,
): Promise<{
	status: number;
	headers: Record<string, string>;
	body: string;
	waitUntil: PromiseLike<any>[];
}> {
	const [r, w] = await handler;
	return {
		status: r.status,
		headers: Object.fromEntries(r.headers),
		body: await r.text(),
		waitUntil: w,
	};
}
