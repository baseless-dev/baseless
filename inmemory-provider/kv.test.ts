import { testKVProvider } from "@baseless/server/provider.test";
import { MemoryKVProvider } from "./kv.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const kv = new MemoryKVProvider();
	await testKVProvider(kv, t);
});
