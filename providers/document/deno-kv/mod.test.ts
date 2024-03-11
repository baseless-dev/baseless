import testDocumentProvider from "../provider.test.ts";
import { DenoKVDocumentProvider } from "./mod.ts";

Deno.test("DenoKVDocumentProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const kv = new DenoKVDocumentProvider(denokv);
	await testDocumentProvider(kv, t);
	denokv.close();
});
