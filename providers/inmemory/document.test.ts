import { testDocumentProvider } from "../../server/provider.test.ts";
import { MemoryDocumentProvider } from "./document.ts";

Deno.test("MemoryKVProvider", async (t) => {
	const provider = new MemoryDocumentProvider();
	await testDocumentProvider(provider, t);
});
