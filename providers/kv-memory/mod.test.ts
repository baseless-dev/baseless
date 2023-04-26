import { MemoryKVProvider } from "./mod.ts";
import testKVProvider from "../../server/providers/kv.test.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const kv = new MemoryKVProvider();
	await testKVProvider(kv, t);
});
