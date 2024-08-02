import { testDocumentProvider } from "@baseless/server/provider.test";
import { MemoryDocumentProvider } from "./document.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const kv = new MemoryDocumentProvider();
	await testDocumentProvider(kv, t);
});
