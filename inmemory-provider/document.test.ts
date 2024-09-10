import { testDocumentProvider } from "../server/document_provider.test.ts";
import { MemoryDocumentProvider } from "./document.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const provider = new MemoryDocumentProvider();
	await testDocumentProvider(provider, t);
});
