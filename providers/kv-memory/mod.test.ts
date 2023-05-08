import testKVProvider from "../kv.test.ts";
import { MemoryKVProvider } from "./mod.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const kv = new MemoryKVProvider();
	await testKVProvider(kv, t);
});
