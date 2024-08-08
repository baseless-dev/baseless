import { testKVProvider } from "@baseless/server/provider.test";
import { MemoryKVProvider } from "./kv.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const provider = new MemoryKVProvider();
	await testKVProvider(provider, t);
});
