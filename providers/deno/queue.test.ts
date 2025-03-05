import { testQueueProvider } from "../../server/provider.test.ts";
import { DenoQueueProvider } from "./queue.ts";

Deno.test("DenoQueueProvider", async (t) => {
	const tempFilePath = await Deno.makeTempFile();
	const denokv = await Deno.openKv(tempFilePath);
	const provider = new DenoQueueProvider(denokv);
	await testQueueProvider(provider, t);
	denokv.close();
});
