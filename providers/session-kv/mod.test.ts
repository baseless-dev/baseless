import { MemoryKVProvider } from "../kv-memory/mod.ts";
import { KVSessionProvider } from "./mod.ts";
import testSessionProvider from "../../server/providers/session.test.ts";

Deno.test("KVSessionProvider", async (t) => {
	const kv = new MemoryKVProvider();
	const ip = new KVSessionProvider(kv);
	await testSessionProvider(ip, t);
});
