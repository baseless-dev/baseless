import { testQueueProvider } from "../../server/provider.test.ts";
import { MemoryQueueProvider } from "./queue.ts";

Deno.test("MemoryQueueProvider", async (t) => {
	const provider = new MemoryQueueProvider();
	await testQueueProvider(provider, t);
});
