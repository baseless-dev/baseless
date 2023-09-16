import testDocumentProvider from "../document.test.ts";
import { MemoryDocumentProvider } from "./mod.ts";

Deno.test("DenoKVDocumentProvider", async (t) => {
	const kv = new MemoryDocumentProvider();
	await testDocumentProvider(kv, t);
});
