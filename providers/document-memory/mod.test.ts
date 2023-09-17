import testDocumentProvider from "../document.test.ts";
import { MemoryDocumentProvider } from "./mod.ts";

Deno.test("MemoryDocumentProvider", async (t) => {
	const kv = new MemoryDocumentProvider();
	await testDocumentProvider(kv, t);
});
