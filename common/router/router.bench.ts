import { Router } from "./router.ts";
import * as t from "../schema/types.ts";

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
	.get(
		"/users/{id}",
		({ params }) => {
			return Response.json({ get: params.id });
		},
	)
	.patch(
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
	)
	.get(
		"/foo",
		({ query }) => {
			return Response.json({ ...query });
		},
		{
			query: t.Object({ foo: t.String(), p: t.Number() }, ["foo"]),
		},
	)
	.use(auth);

const compiled = await app.build();
const dynamic = await app.build(false);

Deno.bench(
	"build router (dynamic)",
	{ group: "build" },
	async () => {
		// deno-lint-ignore no-unused-vars
		const router = await app.build(false);
	},
);

Deno.bench(
	"build router (compiled)",
	{ group: "build", baseline: true },
	async () => {
		// deno-lint-ignore no-unused-vars
		const router = await app.build();
	},
);

Deno.bench(
	"route request (dynamic)",
	{ group: "route" },
	async () => {
		// deno-lint-ignore no-unused-vars
		const response = await dynamic(
			new Request("http://localhost:8080/users/123"),
			{},
		);
	},
);

Deno.bench(
	"route request (compiled)",
	{ group: "route", baseline: true },
	async () => {
		// deno-lint-ignore no-unused-vars
		const response = await compiled(
			new Request("http://localhost:8080/users/123"),
			{},
		);
	},
);
