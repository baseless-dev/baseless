import testIdentityProvider from "../identity.test.ts";
import { MemoryDocumentProvider } from "../document-memory/mod.ts";
import { DocumentIdentityProvider } from "./mod.ts";

Deno.test("DocumentIdentityProvider", async (t) => {
	const backing = new MemoryDocumentProvider();
	const provider = new DocumentIdentityProvider(backing);
	await testIdentityProvider(provider, t);
});
