import { Builder } from "./builder.ts";
import * as t from "../schema/types.ts";

Deno.test("example", () => {
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
				ctx.params.id;
				return Response.json({ ok: true });
			},
		)
		.patch(
			"/users/:id",
			(_req, ctx) => {
				ctx.params.id;
				ctx.body.username;
				return Response.json({ ok: true });
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
		.get(
			"/foo",
			(_req, ctx) => {
				ctx.query.foo;
				return Response.error();
			},
			{
				query: t.Object({ foo: t.String(), p: t.Number() }, ["foo"]),
			},
		)
		.use(auth);

	console.log(Deno.inspect(app.routes, { depth: 10 }));
});
