import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { RouterBuilder } from "./router.ts";

Deno.test("route", async () => {
	const router = new RouterBuilder()
		.get("/foo", () => new Response("bar"))
		.build();

	assertEquals(
		await router.process(
			new Request("http://test.local/foo", { method: "GET" }),
			{},
		).then((r) => r.text()),
		"bar",
	);
	assertEquals(
		await router.process(
			new Request("http://test.local/foo", { method: "POST" }),
			{},
		).then((r) => r.status),
		405,
	);
	assertEquals(
		await router.process(
			new Request("http://test.local/bar", { method: "POST" }),
			{},
		).then((r) => r.status),
		404,
	);
});

Deno.test("nested route", async () => {
	const child = new RouterBuilder()
		.get("/bar", () => new Response("barbar"));
	const parent = new RouterBuilder()
		.get("/foo", () => new Response("bar"))
		.route("/child", child);

	const router = parent.build();

	assertEquals(
		await router.process(new Request("http://test.local/foo"), {}).then((r) =>
			r.text()
		),
		"bar",
	);
	assertEquals(
		await router.process(new Request("http://test.local/bar"), {}).then((r) =>
			r.status
		),
		404,
	);
	assertEquals(
		await router.process(new Request("http://test.local/child"), {}).then((r) =>
			r.status
		),
		404,
	);
	assertEquals(
		await router.process(new Request("http://test.local/child/foo"), {}).then((
			r,
		) => r.status),
		404,
	);
	assertEquals(
		await router.process(new Request("http://test.local/child/bar"), {}).then((
			r,
		) => r.text()),
		"barbar",
	);
});

Deno.test("route params", async () => {
	const child = new RouterBuilder().get(
		"/bar",
		(_, params) => new Response(JSON.stringify(params)),
	);
	const parent = new RouterBuilder()
		.get("/users/:id", (_req, params) => new Response(params.id))
		.route("/child/:id", child);
	const router = parent.build();

	assertEquals(
		await router.process(new Request("http://test.local/users"), {}).then((r) =>
			r.status
		),
		404,
	);
	assertEquals(
		await router.process(new Request("http://test.local/users/123"), {}).then((
			r,
		) => r.text()),
		"123",
	);
	assertEquals(
		await router.process(new Request("http://test.local/child"), {}).then((r) =>
			r.status
		),
		404,
	);
	assertEquals(
		await router.process(new Request("http://test.local/child/456"), {}).then((
			r,
		) => r.status),
		404,
	);
	assertEquals(
		await router.process(new Request("http://test.local/child/456/bar"), {})
			.then((r) => r.text()),
		`{"id":"456"}`,
	);
});
