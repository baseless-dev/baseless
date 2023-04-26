import {
	assertEquals,
	assertExists,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { SqliteKVProvider } from "../kv-sqlite/mod.ts";
import { KVClientProvider } from "./mod.ts";

Deno.test("add & get", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	const registry = new KVClientProvider(kv);
	await registry.add({ client_id: "acme" });
	await assertRejects(() => registry.add({ client_id: "acme" }));
	const client = await registry.get("acme");
	assertEquals(client.client_id, "acme");
	await kv.close();
});

Deno.test("remove", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();
	const registry = new KVClientProvider(kv);
	await registry.add({ client_id: "acme" });
	assertExists(await registry.get("acme"));
	await registry.remove("acme");
	await assertRejects(() => registry.get("acme"));
	await kv.close();
});