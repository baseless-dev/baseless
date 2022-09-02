import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { ClientMemoryProvider } from "./mod.ts";

Deno.test("add & get", async () => {
	const registry = new ClientMemoryProvider();
	await registry.add({ id: "acme", principal: "ACME" });
	const client = await registry.get("acme");
	assertEquals(client.principal, "ACME");
});

Deno.test("remove", async () => {
	const registry = new ClientMemoryProvider();
	await registry.add({ id: "acme", principal: "ACME" });
	assertExists(await registry.get("acme"));
	await registry.remove("acme");
	await assertRejects(() => registry.get("acme"));
});
