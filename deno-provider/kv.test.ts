import { testKVProvider } from "@baseless/server/provider/kv.test";
import { DenoKVProvider } from "./kv.ts";

Deno.test("DenoKVProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const provider = new DenoKVProvider(denokv);
	await testKVProvider(provider, t);
	denokv.close();
});
