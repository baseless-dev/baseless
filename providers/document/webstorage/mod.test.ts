import testDocumentProvider from "../provider.test.ts";
import { WebStorageDocumentProvider } from "./mod.ts";

Deno.test("WebStorageDocumentProvider", async (t) => {
	const provider = new WebStorageDocumentProvider(
		sessionStorage,
		"baseless-kv-webstorage-test-put",
	);
	await testDocumentProvider(provider, t);
});
