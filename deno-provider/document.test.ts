import { testDocumentProvider } from "@baseless/server/provider/document.test";
import { DenoKVDocumentProvider } from "./document.ts";

Deno.test("DenoKVProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const provider = new DenoKVDocumentProvider(denokv);
	await testDocumentProvider(provider, t);
	denokv.close();
});
