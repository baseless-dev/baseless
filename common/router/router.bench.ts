import { Router } from "./router.ts";
import * as t from "../schema/types.ts";

const auth = new Router()
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

const app = new Router()
	.get(
		"/users/:id",
		(_req, ctx) => {
			return Response.json({ get: ctx.params.id });
		},
	)
	.patch(
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
	.get(
		"/foo",
		(_req, ctx) => {
			return Response.json({ foo: ctx.query.foo, p: ctx.query.p });
		},
		{
			query: t.Object({ foo: t.String(), p: t.Number() }, ["foo"]),
		},
	)
	.use(auth);

const compiled = app.build();
const dynamic = app.build(false);

Deno.bench(
	"build router (dynamic)",
	{ group: "build", baseline: true },
	() => {
		// deno-lint-ignore no-unused-vars
		const router = app.build(false);
	},
);

Deno.bench(
	"build router (compiled)",
	{ group: "build" },
	() => {
		// deno-lint-ignore no-unused-vars
		const router = app.build();
	},
);

Deno.bench(
	"route request (dynamic)",
	{ group: "route", baseline: true },
	async () => {
		// deno-lint-ignore no-unused-vars
		const response = await dynamic(
			new Request("http://localhost:8080/users/123"),
		);
	},
);

Deno.bench(
	"route request (compiled)",
	{ group: "route" },
	async () => {
		// deno-lint-ignore no-unused-vars
		const response = await compiled(
			new Request("http://localhost:8080/users/123"),
		);
	},
);
