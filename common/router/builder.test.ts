import { Builder } from "./builder.ts";
import * as t from "../schema/types.ts";

Deno.test("example", () => {
	const auth = new Builder()
		.post(
			"/login",
			(_req, ctx) => Response.json(ctx.body),
			{
				body: t.Referenceable(
					"auth/usercreds",
					t.Object({ username: t.String(), password: t.String() }, [
						"username",
						"password",
					]),
				),
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

	type usersBody = t.Infer<typeof app["routes"]["/users/:id"]["GET"]["params"]>;
	type fooBody = t.Infer<typeof app["routes"]["/foo"]["GET"]["query"]>;
	type loginBody = t.Infer<typeof app["routes"]["/login"]["POST"]["body"]>;

	console.log(Deno.inspect(app.routes, { depth: 10 }));
});
