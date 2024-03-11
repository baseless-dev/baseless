import { MemoryKVProvider } from "../../kv/memory/mod.ts";
import testSessionProvider from "../provider.test.ts";
import { KVSessionProvider } from "./mod.ts";

Deno.test("KVSessionProvider", async (t) => {
	const kv = new MemoryKVProvider();
	const ip = new KVSessionProvider(kv);
	await testSessionProvider(ip, t);
});
