import { testStorageProvider } from "../../server/provider.test.ts";
import { MemoryStorageProvider } from "./storage.ts";

Deno.test("MemoryStorageProvider", async (t) => {
	using provider = new MemoryStorageProvider();
	await testStorageProvider(provider, t);
});
