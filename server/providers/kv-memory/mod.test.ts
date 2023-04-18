import { MemoryKVProvider } from "./mod.ts";
import testKVProvider from "../kv.test.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const kv = new MemoryKVProvider();
	await testKVProvider(kv, t);
});
