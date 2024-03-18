import testCounterProvider from "../provider.test.ts";
import { MemoryCounterProvider } from "./mod.ts";

Deno.test("MemoryCounterProvider", async (t) => {
	const cp = new MemoryCounterProvider();
	await testCounterProvider(cp, t);
});