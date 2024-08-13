import { testSessionProvider } from "@baseless/server/provider/session.test";
import { DenoKVSessionProvider } from "./session.ts";

Deno.test("DenoKVSessionProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const provider = new DenoKVSessionProvider(denokv);
	await testSessionProvider(provider, t);
	denokv.close();
});
