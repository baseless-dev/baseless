import { MemoryKVProvider } from "../kv-memory/mod.ts";
import { KVIdentityProvider } from "./mod.ts";
import testIdentityProvider from "../../server/providers/identity.test.ts";

Deno.test("KVIdentityProvider", async (t) => {
	const kv = new MemoryKVProvider();
	const ip = new KVIdentityProvider(kv);
	await testIdentityProvider(ip, t);
});
