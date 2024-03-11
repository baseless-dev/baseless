import testKVProvider from "../provider.test.ts";
import { DenoKVProvider } from "./mod.ts";

Deno.test("DenoKVProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const kv = new DenoKVProvider(denokv);
	await testKVProvider(kv, t);
	denokv.close();
});
