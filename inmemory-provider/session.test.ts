import { testSessionProvider } from "@baseless/server/provider/session.test";
import { MemorySessionProvider } from "./session.ts";

Deno.test("MemorySessionProvider", async (t) => {
	const provider = new MemorySessionProvider();
	await testSessionProvider(provider, t);
});
