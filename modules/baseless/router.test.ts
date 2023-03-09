import { assertEquals, assertRejects } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { Router } from "./router.ts";

Deno.test("route get", async () => {
	const router = new Router();
	router.get("/foo", () => new Response("bar"));

	assertEquals(await router.process(new Request("http://test.local/foo", { method: "GET" }), {}).then((r) => r.text()), "bar");
	assertRejects(async () => await router.process(new Request("http://test.local/foo", { method: "POST" }), {}));
	assertRejects(async () => await router.process(new Request("http://test.local/bar", { method: "GET" }), {}));
});

Deno.test("route post", async () => {
	const router = new Router();
	router.post("/foo", () => new Response("bar"));

	assertEquals(await router.process(new Request("http://test.local/foo", { method: "POST" }), {}).then((r) => r.text()), "bar");
	assertRejects(async () => await router.process(new Request("http://test.local/foo"), {}));
	assertRejects(async () => await router.process(new Request("http://test.local/bar", { method: "POST" }), {}));
});

Deno.test("route put", async () => {
	const router = new Router();
	router.put("/foo", () => new Response("bar"));

	assertEquals(await router.process(new Request("http://test.local/foo", { method: "PUT" }), {}).then((r) => r.text()), "bar");
	assertRejects(async () => await router.process(new Request("http://test.local/foo"), {}));
	assertRejects(async () => await router.process(new Request("http://test.local/bar", { method: "PUT" }), {}));
});

Deno.test("route delete", async () => {
	const router = new Router();
	router.delete("/foo", () => new Response("bar"));

	assertEquals(await router.process(new Request("http://test.local/foo", { method: "DELETE" }), {}).then((r) => r.text()), "bar");
	assertRejects(async () => await router.process(new Request("http://test.local/foo"), {}));
	assertRejects(async () => await router.process(new Request("http://test.local/bar", { method: "DELETE" }), {}));
});

Deno.test("nested route", async () => {
	const parent = new Router();
	parent.get("/foo", () => new Response("bar"));

	const child = new Router();
	child.get("/bar", () => new Response("barbar"));

	parent.route("/child", child);

	assertEquals(await parent.process(new Request("http://test.local/foo"), {}).then((r) => r.text()), "bar");
	assertRejects(async () => await parent.process(new Request("http://test.local/bar"), {}).then((r) => r.text()));
	assertRejects(async () => await parent.process(new Request("http://test.local/child"), {}).then((r) => r.text()));
	assertRejects(async () => await parent.process(new Request("http://test.local/child/foo"), {}).then((r) => r.text()));
	assertEquals(await parent.process(new Request("http://test.local/child/bar"), {}).then((r) => r.text()), "barbar");
});

Deno.test("route params", async () => {
	const router = new Router();
	router.get("/users/:id", (_req, params) => new Response(params.id));

	const child = new Router();
	child.get("/bar", (_, params) => new Response(JSON.stringify(params)));

	router.route("/child/:id", child);

	assertRejects(async () => await router.process(new Request("http://test.local/users"), {}).then((r) => r.text()));
	assertEquals(await router.process(new Request("http://test.local/users/123"), {}).then((r) => r.text()), "123");
	assertRejects(async () => await router.process(new Request("http://test.local/child"), {}).then((r) => r.text()));
	assertRejects(async () => await router.process(new Request("http://test.local/child/456"), {}).then((r) => r.text()));
	assertEquals(await router.process(new Request("http://test.local/child/456/bar"), {}).then((r) => r.text()), "{}");
});
