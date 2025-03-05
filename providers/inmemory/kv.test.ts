import { testKVProvider } from "../../server/provider.test.ts";
import { MemoryKVProvider } from "./kv.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const provider = new MemoryKVProvider();
	await testKVProvider(provider, t);
});
