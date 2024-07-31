import { testDocumentProvider } from "@baseless/server/provider.test";
import { MemoryDocumentProvider } from "./mod.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const kv = new MemoryDocumentProvider();
	await testDocumentProvider(kv, t);
});
