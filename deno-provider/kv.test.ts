import { testKVProvider } from "@baseless/server/provider.test";
import { DenoKVProvider } from "./kv.ts";

Deno.test("DenoKVProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const kv = new DenoKVProvider(denokv);
	await testKVProvider(kv, t);
	denokv.close();
});
