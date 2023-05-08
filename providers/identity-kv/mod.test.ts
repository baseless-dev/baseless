import testIdentityProvider from "../identity.test.ts";
import { MemoryKVProvider } from "../kv-memory/mod.ts";
import { KVIdentityProvider } from "./mod.ts";

Deno.test("KVIdentityProvider", async (t) => {
	const kv = new MemoryKVProvider();
	const ip = new KVIdentityProvider(kv);
	await testIdentityProvider(ip, t);
});
