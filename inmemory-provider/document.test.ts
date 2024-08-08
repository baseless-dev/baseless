import { testDocumentProvider } from "@baseless/server/provider.test";
import { MemoryDocumentProvider } from "./document.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const provider = new MemoryDocumentProvider();
	await testDocumentProvider(provider, t);
});
