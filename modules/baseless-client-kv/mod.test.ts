import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { KVDenoDBProvider } from "https://baseless.dev/x/baseless-kv-deno-sqlite/mod.ts";
import { ClientKVProvider } from "./mod.ts";

Deno.test("add & get", async () => {
	const kv = new KVDenoDBProvider(":memory:");
	await kv.open();
	const registry = new ClientKVProvider(kv);
	await registry.add({ id: "acme", principal: "ACME" });
	await assertRejects(() => registry.add({ id: "acme", principal: "ACME" }));
	const client = await registry.get("acme");
	assertEquals(client.principal, "ACME");
	await kv.close();
});

Deno.test("remove", async () => {
	const kv = new KVDenoDBProvider(":memory:");
	await kv.open();
	const registry = new ClientKVProvider(kv);
	await registry.add({ id: "acme", principal: "ACME" });
	assertExists(await registry.get("acme"));
	await registry.remove("acme");
	await assertRejects(() => registry.get("acme"));
	await kv.close();
});
